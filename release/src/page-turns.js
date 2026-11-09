import {freezeEpubViewport} from './epub-snapshot.js';
import {prepareAdjacentPage} from './adjacent-pages.js';

// Move visual copies, never live text. Pagination and source anchors remain
// entirely owned by the existing reader, including chapter boundaries.
export function attachPageTurns(win=window,doc=win.document){
 let gesture=null,queuedTouch=null,discardTouch=false,layer=null,busy=false,internal=false,suppressUntil=0,timer=0,frame=0,observer=null,nativeRoot=null;
 let settlement=null,disposed=false,idle=0;
 const metrics={gestures:0,frames:0,frameIntervals:[],paintMs:[],settleMs:[],captures:0};
 const diagnostics=new URLSearchParams(win.location?.search||'').has('libraPerf');
 if(diagnostics)win.libraPageTurnMetrics=metrics;
 const tapQueue=[];let queueTimer=0,paintFrame=0,pendingPaint=null;
 let previewState=null,warmTimer=0;
 const locationOf=rendition=>{try{return rendition?.currentLocation()}catch{return null}};
 // A cheap identity check prevents a seek/settings render from activating
 // old visual planes before the idle geometry preparation can run.
 const identity=r=>{
  const view=r.querySelector('.reading-content .page-viewport')||r.querySelector('.reading-content .epub-mount');
  const fb2=view?.libraFb2Preview?.state(),epub=view?.libraEpubPreview?.state();
  return JSON.stringify([r.dataset.bookId,fb2||epub?null:status(r),r.dataset.pageAnimation,view?.getAttribute('style'),view?.querySelector('.book-flow')?.style.transform,fb2?.key,fb2?.chapter,fb2?.page,epub?.key,locationOf(epub?.rendition)?.start?.cfi]);
 };
 const previewKey=r=>{
  const view=r.querySelector('.reading-content .page-viewport')||r.querySelector('.reading-content .epub-mount');if(!view)return '';
  const box=view.getBoundingClientRect(),epub=view.libraEpubPreview?.state(),fb2=view.libraFb2Preview?.state();
  return JSON.stringify([identity(r),box.width,box.height,win.getComputedStyle(r).getPropertyValue('--bg')]);
 };
 function localNeighbor(r,d){
  const view=r.querySelector('.reading-content .page-viewport')||r.querySelector('.reading-content .epub-mount');if(!view)return null;
  const box=view.getBoundingClientRect(),flow=view.querySelector('.book-flow');
  let page;
  if(flow){
   const stride=Number(flow.dataset.columnStride)||box.width+24,current=Math.round((box.left-flow.getBoundingClientRect().left)/stride),count=Math.max(1,Math.ceil((flow.scrollWidth-24)/stride));
   if(current+d<0||current+d>=count)return null;
   page=capture(r);if(!page)return null;
   const frozen=page.sheet.querySelector('.book-flow');frozen.style.transform=(frozen.style.transform==='none'?'':frozen.style.transform)+` translateX(${-d*stride}px)`;
  }else{
   const frame=Array.from(view.querySelectorAll('iframe')).find(frame=>{const b=frame.getBoundingClientRect();return b.right>box.left&&b.left<box.right&&b.bottom>box.top&&b.top<box.bottom});
   if(!frame)return null;
   const b=frame.getBoundingClientRect(),current=Math.round((box.left-b.left)/box.width),count=Math.max(1,Math.round(b.width/box.width));
   if(current+d<0||current+d>=count)return null;
   page=capture(r);if(!page)return null;
   for(const plane of page.sheet.querySelectorAll('.epub-transition-freeze>div'))plane.style.left=(parseFloat(plane.style.left)||0)-d*box.width+'px';
  }
  page.sheet.dataset.libraTurnSheet='incoming';return page.sheet;
 }
 function liveSettled(r){
  const api=r.querySelector('.reading-content .epub-mount')?.libraEpubPreview;if(!api)return true;
  const state=api.state(),location=locationOf(state.rendition);if(!location)return false;
  const loc=api.physical(location);if(!loc?.cfi)return false;
  // During EPUB restoration the iframe can briefly show the CFI's containing
  // screen before React restores the saved physical page. Do not cache that
  // intermediate screen as an interactive neighbor.
  const reported=position(r);if(!reported)return false;
  if(reported.total<loc.total)return false;
  if(loc.index===state.spine[0]?.index)return reported.page===loc.page;
  if(loc.index===state.spine.at(-1)?.index)return reported.page===reported.total-loc.total+loc.page;
  const fallback=status(r).match(/Страница\s+(\d+)\s+из\s+(\d+)/i);
  return !fallback||(Number(fallback[1])===loc.page&&Number(fallback[2])===loc.total);
 }
 function warm(r=root()){
  if(disposed)return;
  if(!r){dropPreview();return;}
  if(!enabled(r)||busy||layer||gesture)return;
  if(!liveSettled(r)){scheduleWarm();return;}
  let key;try{key=previewKey(r)}catch{return;}
  if(previewState?.r===r&&previewState.key===key){for(const [d,entry] of previewState.entries)if(entry.sheet&&!entry.sheet.isConnected)mountNeighbor(previewState,d,entry.sheet);return;}
  dropPreview();
  let base;try{base=capture(r)}catch{}
  const state={r,key,identity:identity(r),base:base?.sheet||null,width:base?.width||0,controller:new win.AbortController(),entries:new Map(),shell:null,track:null};previewState=state;
  if(state.base){
   state.shell=doc.createElement('div');state.shell.dataset.libraPageTurn='';state.shell.setAttribute('aria-hidden','true');state.shell.setAttribute('inert','');
   state.track=doc.createElement('div');state.track.dataset.libraTurnTrack='';state.track.append(state.base);state.shell.append(state.track);
  }
  for(const d of [-1,1]){
   if(boundary(r,d))continue;
   let sheet;try{sheet=localNeighbor(r,d)}catch{}
   const entry={sheet:sheet||null,pending:null};state.entries.set(d,entry);
   if(sheet&&state.track)mountNeighbor(state,d,sheet);
   if(!sheet)entry.pending=prepareAdjacentPage(r,d,{win,signal:state.controller.signal,capture}).then(sheet=>{
    if(previewState!==state||state.controller.signal.aborted)return;
    entry.sheet=sheet;
    if(sheet&&state.track&&!gesture&&!busy)mountNeighbor(state,d,sheet);
   }).catch(()=>{});
  }
  if(state.shell)r.append(state.shell);
 }
 function dropPreview(){previewState?.controller.abort();previewState?.shell?.remove();previewState=null;}
 function mountNeighbor(state,d,sheet){sheet.dataset.libraTurnSheet='incoming';sheet.style.transform=`translate3d(${d*state.width}px,0,0)`;state.track.append(sheet);}
 function scheduleWarm(){
  if(disposed||warmTimer||gesture||busy)return;
  warmTimer=win.setTimeout(()=>{warmTimer=0;
   if(win.requestIdleCallback){idle=win.requestIdleCallback(()=>{idle=0;warm()},{timeout:120});}else warm();
  },24);
 }
 function installIncoming(s,d){
  s.d=d;s.incoming=previewState?.r===s.r?previewState.entries.get(d)?.sheet||null:null;
 }

 const style=doc.createElement('style');
 style.dataset.libraPageTurns='true';
 style.textContent=`
 [data-libra-page-turn]{position:absolute;inset:0;z-index:8;overflow:hidden;pointer-events:none;contain:layout paint;background:var(--bg);visibility:hidden}
 [data-libra-page-turn][data-active]{visibility:visible}
 [data-libra-turn-track]{position:absolute;inset:0;transform:translate3d(0,0,0)}
 [data-libra-page-turn][data-active] [data-libra-turn-track]{will-change:transform}
 [data-libra-turn-sheet]{position:absolute;overflow:hidden;background:var(--bg);color:var(--fg);pointer-events:none}
 [data-libra-turn-sheet=outgoing]{z-index:2}
 .reading-root:not(.reading-quote-mode):not(.reading-scroll-safe)>.reading-zones{touch-action:none;overscroll-behavior:none}
 [data-libra-turn-sheet] .book-flow{transition:none!important;animation:none!important}
 [data-libra-turn-sheet] .page-viewport{position:absolute!important;overflow:hidden!important}
 .reading-root[data-libra-native-turn]>.reading-content .book-flow{transition:none!important}
 .reading-root[data-libra-native-turn]>.reading-content .epub-transition-freeze{visibility:hidden!important}
 @media(prefers-reduced-motion:reduce){[data-libra-page-turn]{display:none}}
 `;
 doc.head.append(style);
 const root=()=>doc.querySelector('.reading-root');
 const blocked=r=>!r||r.matches('.reading-modal-open,.reading-quote-mode,.reading-scroll-safe')||r.querySelector('.sheet-scrim:not(.sheet-exiting),.book-loading,.clipping-alert')||doc.visibilityState==='hidden';
 const enabled=r=>!blocked(r)&&r.dataset.pageAnimation!=='none'&&!win.matchMedia('(prefers-reduced-motion: reduce)').matches&&!r.querySelector('.reading-content .book-flow.no-animation');
 const status=r=>r.querySelector('.reading-status span')?.textContent||'';
 const position=r=>{const match=status(r).match(/(\d+)\s*(?:\/|из)\s*(\d+)/i);return match?{page:Number(match[1]),total:Number(match[2])}:null;};
 const boundary=(r,d)=>{
  const view=r.querySelector('.reading-content .page-viewport')||r.querySelector('.reading-content .epub-mount');
  const fb2=view?.libraFb2Preview?.state();if(fb2?.total>0)return d<0?fb2.chapter===0&&fb2.page<=0:fb2.chapter===fb2.total-1&&fb2.page>=fb2.pages-1;
  const api=view?.libraEpubPreview,epub=api?.state(),location=locationOf(epub?.rendition),loc=location&&api.physical(location);
  if(loc?.cfi&&epub.spine.length)return d<0?loc.index===epub.spine[0].index&&loc.page<=1:loc.index===epub.spine.at(-1).index&&loc.page>=loc.total;
  const page=position(r);return page&&(d<0?page.page<=1:page.page>=page.total);
 };
 function clear(){
  win.cancelAnimationFrame(paintFrame);paintFrame=0;pendingPaint=null;
  win.clearTimeout(timer);timer=0;win.cancelAnimationFrame(frame);frame=0;observer?.disconnect();observer=null;
  const changed=settlement?.commit;
  settlement=null;
  if(layer){layer.removeAttribute('data-active');const track=layer.querySelector('[data-libra-turn-track]');if(track)track.style.transform='translate3d(0px,0px,0px)';if(layer!==previewState?.shell)layer.remove();}
  layer=null;nativeRoot?.removeAttribute('data-libra-native-turn');nativeRoot=null;busy=false;
  if(changed)dropPreview();
  scheduleWarm();scheduleQueue();
 }
 function cancel(){if(gesture||queuedTouch)suppressUntil=Date.now()+700;gesture=null;queuedTouch=null;discardTouch=false;tapQueue.length=0;clear();dropPreview();scheduleWarm();}
 function sanitize(copy){
  for(const el of [copy,...copy.querySelectorAll('*')]){
   el.removeAttribute('id');el.removeAttribute('autofocus');
   for(const a of Array.from(el.attributes))if(/^on/i.test(a.name))el.removeAttribute(a.name);
  }
  for(const el of copy.querySelectorAll('script,iframe,object,embed,audio,video,.fb2-transition-freeze,.chapter-page-freeze,.epub-transition-freeze'))el.remove();
 }
 function capture(r,alternateView=null,placement=null){
  metrics.captures++;
  const view=alternateView||r.querySelector('.reading-content .page-viewport')||r.querySelector('.reading-content .epub-mount');
  if(!view)return null;
  const box=placement||view.getBoundingClientRect(),bounds=r.getBoundingClientRect();
  if(box.width<1||box.height<1||bounds.width<1||bounds.height<1)return null;
  const flow=view.querySelector('.book-flow'),sourceDocument=view.querySelector('iframe')?.contentDocument;
  if((sourceDocument?.getElementsByTagName('*').length||view.getElementsByTagName('*').length)>5000)return null;
  const sheet=doc.createElement('div');sheet.dataset.libraTurnSheet='outgoing';
  Object.assign(sheet.style,{left:'0px',top:'0px',width:bounds.width+'px',height:bounds.height+'px'});
  const inset={position:'absolute',left:box.left-bounds.left+'px',top:box.top-bounds.top+'px',right:'auto',bottom:'auto',width:box.width+'px',height:box.height+'px'};
  if(flow){
   const copy=view.cloneNode(true);sanitize(copy);Object.assign(copy.style,inset);
   const frozen=copy.querySelector('.book-flow'),transform=win.getComputedStyle(flow).transform;
   frozen.style.transform=transform;frozen.classList.add('no-animation');sheet.append(copy);
  }else{
   const undo=freezeEpubViewport(view),frozen=view.lastElementChild;
   if(!frozen?.classList.contains('epub-transition-freeze')){undo();return null;}
   const holder=doc.createElement('div');Object.assign(holder.style,inset);holder.append(frozen);sheet.append(holder);
  }
  return {sheet,width:bounds.width,flow,box};
 }
 function snapshot(r,d,{fresh=false}={}){
  if(previewState?.r===r&&previewState.identity!==identity(r)){dropPreview();scheduleWarm();}
  if(fresh&&previewState?.r===r&&previewState.shell?.isConnected){
   const state=previewState;state.shell.dataset.active='';layer=state.shell;
   return {r,shell:state.shell,track:state.track,sheet:state.base,incoming:null,width:state.width,d,offset:0};
  }
  if(fresh){
   const page=capture(r);if(!page)return null;
   const shell=doc.createElement('div'),track=doc.createElement('div');shell.dataset.libraPageTurn='';shell.setAttribute('aria-hidden','true');shell.setAttribute('inert','');track.dataset.libraTurnTrack='';track.append(page.sheet);shell.append(track);r.append(shell);shell.dataset.active='';layer=shell;
   return {r,shell,track,sheet:page.sheet,incoming:null,width:page.width,d,offset:0,fresh:true};
  }
  const state=previewState;if(state?.r!==r||!state.base||!state.shell?.isConnected)return null;
  const incoming=state.entries.get(d)?.sheet;
  // A cold chapter uses the existing instant navigation path; never expose
  // paper or substitute an unrelated page when a preview is not ready yet.
  if(!incoming?.isConnected)return null;
  state.shell.dataset.active='';layer=state.shell;
  const s={r,shell:state.shell,track:state.track,sheet:state.base,incoming,width:state.width,d,offset:0,lastFrame:0};return s;
 }
 function safeSnapshot(r,d,options){try{return snapshot(r,d,options)}catch{clear();return null}}
 function flushPaint(){
  win.cancelAnimationFrame(paintFrame);paintFrame=0;
  const state=pendingPaint;pendingPaint=null;if(!state||layer!==state.shell)return;
  const before=diagnostics?win.performance.now():0;
  state.track.style.transform=`translate3d(${state.offset}px,0px,0px)`;
  if(diagnostics){const now=win.performance.now();if(state.lastFrame)metrics.frameIntervals.push(now-state.lastFrame);state.lastFrame=now;metrics.frames++;metrics.paintMs.push(now-before);if(metrics.frameIntervals.length>1200)metrics.frameIntervals.shift();if(metrics.paintMs.length>1200)metrics.paintMs.shift();}
 }
 function move(state,offset){
  const entries=previewState?.r===state.r?previewState.entries:null;
  const min=entries?.get(1)?.sheet?.isConnected?-state.width:0,max=entries?.get(-1)?.sheet?.isConnected?state.width:0;
  state.offset=Math.max(min,Math.min(max,offset));
  pendingPaint=state;if(!paintFrame)paintFrame=win.requestAnimationFrame(flushPaint);
 }
 function navigate(r,d){internal=true;try{r.dispatchEvent(new win.KeyboardEvent('keydown',{key:d>0?'ArrowRight':'ArrowLeft',bubbles:true,cancelable:true}));}finally{internal=false;}}
 function edgeDirection(r,x){const box=r.querySelector('.reading-zones')?.getBoundingClientRect();if(!box?.width)return 0;const ratio=(x-box.left)/box.width;return ratio<.28?-1:ratio>.72?1:0;}
 function interactiveAt(r,x,y){
  const zones=r.querySelector('.reading-zones'),content=r.querySelector('.reading-content');if(!zones||!content)return false;
  const z=zones.style.pointerEvents,c=content.style.pointerEvents;
  try{zones.style.pointerEvents='none';content.style.pointerEvents='auto';let hit=doc.elementFromPoint?.(x,y);
   if(hit?.tagName==='IFRAME'){const box=hit.getBoundingClientRect();hit=hit.contentDocument?.elementFromPoint(x-box.left,y-box.top);}
   return !!hit?.closest?.('img,svg,a,button,[role=button],[data-note]');
  }catch{return true}finally{zones.style.pointerEvents=z;content.style.pointerEvents=c;}
 }
 function queueTap(r,d,animated=false){tapQueue.push({r,d,animated,expires:win.performance.now()+1000});drainQueue();}
 function scheduleQueue(delay=0){if(!queueTimer&&!disposed)queueTimer=win.setTimeout(()=>{queueTimer=0;drainQueue()},delay);}
 function drainQueue(){
  if(busy||layer||gesture)return;
  while(tapQueue.length){
   const entry=tapQueue[0],{r,d,animated}=entry;
   if(root()!==r||blocked(r)){tapQueue.length=0;return;}
   if(boundary(r,d)){tapQueue.shift();continue;}
   let state=safeSnapshot(r,d,{fresh:!animated});
   if(animated&&!state&&win.performance.now()<entry.expires){
    if(!entry.preparing){entry.preparing=true;warm(r);state=safeSnapshot(r,d);}
    if(!state){scheduleQueue(24);return;}
   }
   tapQueue.shift();
   if(!state)state=safeSnapshot(r,d,{fresh:true});
   if(state)settle(state,true,{instant:!animated||!state.incoming});else{navigate(r,d);scheduleQueue();}
   return;
  }
 }
 function settle(s,commit,{instant=false,velocity=0}={}){
  flushPaint();busy=true;
  const phase={s,commit,ready:!commit,done:instant,instant,navigated:false,started:win.performance.now()};settlement=phase;
  const finish=()=>{if(settlement!==phase||!phase.ready||!phase.done)return;clear();if(s.fresh)s.shell.remove();};
  if(!instant){
   const from=s.offset,to=commit?-s.d*s.width:0,distance=to-from;
   const speed=Math.sign(distance)*velocity;
   const duration=Math.max(100,Math.min(280,Math.abs(distance)/Math.max(.8,speed)));
   const slope=Math.max(0,Math.min(2,speed*duration/Math.max(1,Math.abs(distance))));
   const started=win.performance.now();
   const step=now=>{
    if(settlement!==phase)return;
    const t=Math.max(0,Math.min(1,(now-started)/duration));
    // Monotone cubic Hermite: start at the finger's velocity and settle at
    // zero speed, without a spring, overshoot or a release-time layout read.
    const eased=(-2*t*t*t+3*t*t)+slope*(t*t*t-2*t*t+t);
    s.offset=from+distance*eased;pendingPaint=s;flushPaint();
    if(t<1)frame=win.requestAnimationFrame(step);
    else{frame=0;phase.done=true;if(diagnostics){metrics.settleMs.push(now-started);if(metrics.settleMs.length>100)metrics.settleMs.shift();}beginNavigation();finish();}
   };
   frame=win.requestAnimationFrame(step);
  }
  if(!commit){finish();return;}
  const before=status(s.r);
  const location=()=>{const view=s.r.querySelector('.reading-content .page-viewport')||s.r.querySelector('.reading-content .epub-mount'),fb2=view?.libraFb2Preview?.state(),epub=view?.libraEpubPreview?.state();return fb2?JSON.stringify([fb2.chapter,fb2.page]):locationOf(epub?.rendition)?.start?.cfi||null;};
  const beforeLocation=location();
  const ready=()=>{
   if(settlement!==phase||phase.ready)return;
   if(root()!==s.r||s.r.matches('.reading-modal-open,.reading-quote-mode')){cancel();return;}
   if(s.r.querySelector('.book-loading,.clipping-alert,.reading-content .epub-transition-freeze,.reading-content .chapter-page-freeze'))return;
   if(beforeLocation?location()===beforeLocation:status(s.r)===before)return;
   const epub=s.r.querySelector('.reading-content .epub-mount')?.libraEpubPreview;
   if(epub&&!phase.epubSettled){
    if(!phase.checking){phase.checking=true;
     // epub.js changes currentLocation before its queued settle/React save
     // completes. Keep the final visual page until that commit has run, so
     // an immediate exit/reopen cannot restore the previous saved CFI.
     Promise.resolve(epub.settle(epub.state().rendition)).then(()=>{
      if(settlement!==phase)return;
      frame=win.requestAnimationFrame(()=>{frame=0;phase.epubSettled=true;phase.checking=false;ready();});
     }).catch(()=>{if(settlement===phase)clear();});
    }
    return;
   }
   if(!liveSettled(s.r))return;
   phase.ready=true;observer?.disconnect();observer=null;win.clearTimeout(timer);
   // rAF is only a handoff fence, never a recapture of live chapter DOM.
   if(instant){frame=win.requestAnimationFrame(finish);}else finish();
  };
  function beginNavigation(){
   if(!commit||settlement!==phase||phase.navigated)return;phase.navigated=true;
   observer=new win.MutationObserver(ready);observer.observe(s.r,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-ready','class']});
   nativeRoot=s.r;nativeRoot.setAttribute('data-libra-native-turn','');
   navigate(s.r,s.d);ready();
   if(settlement===phase&&!phase.ready)timer=win.setTimeout(()=>{if(settlement===phase)clear();},6000);
  }
  if(instant)beginNavigation();
  // On a failed navigation recover the live reader instead of keeping an
  // optimistic preview indefinitely. The reader owns errors and progress.

 }
 function start(event){
  if(busy&&settlement&&!settlement.navigated){
   const phase=settlement,s=phase.s,p=event.touches[0];
   if(p&&event.touches.length===1&&event.target?.closest?.('.reading-zones')){
    win.cancelAnimationFrame(frame);frame=0;settlement=null;busy=false;
    const now=win.performance.now();gesture={r:s.r,x:p.clientX-s.offset,y:p.clientY,time:now,lastDx:s.offset,trail:[{x:p.clientX,time:now}],s,vertical:false,nativeOnly:false};event.stopPropagation();return;
   }
  }
  if(busy){
   const p=event.touches[0],r=root();queuedTouch=p&&event.touches.length===1&&event.target?.closest?.('.reading-zones')?{r,x:p.clientX,y:p.clientY,time:win.performance.now(),moved:false}:null;
   discardTouch=true;event.stopPropagation();return;
  }
  discardTouch=false;queuedTouch=null;suppressUntil=0;
  if(gesture||event.touches.length!==1){cancel();if(event.touches.length!==1)return;}
  const r=root();if(blocked(r)||!event.target?.closest?.('.reading-zones'))return;
  const p=event.touches[0];if(diagnostics)metrics.gestures++;gesture={r,x:p.clientX,y:p.clientY,time:win.performance.now(),lastDx:0,trail:[{x:p.clientX,time:win.performance.now()}],s:null,vertical:false,nativeOnly:!enabled(r)||previewState?.r!==r||previewState.identity!==identity(r)};
 }
 function drag(event){
  if(discardTouch){const p=event.touches[0];if(queuedTouch&&(!p||event.touches.length!==1||Math.hypot(p.clientX-queuedTouch.x,p.clientY-queuedTouch.y)>10))queuedTouch.moved=true;event.preventDefault();event.stopPropagation();return;}
  const g=gesture;if(!g)return;
  if(event.touches.length!==1||blocked(g.r)){cancel();discardTouch=true;event.stopPropagation();return;}
  const p=event.touches[0],dx=p.clientX-g.x,dy=p.clientY-g.y,now=win.performance.now();g.lastDx=dx;g.trail.push({x:p.clientX,time:now});while(g.trail.length>2&&g.trail[0].time<now-100)g.trail.shift();
  if(g.nativeOnly)return;
  if(!g.s){
   if(g.vertical)return;
   if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){g.vertical=true;return;}
   if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.3)return;
   const d=dx<0?1:-1;if(boundary(g.r,d)){g.vertical=true;return;}
   g.s=safeSnapshot(g.r,d);if(!g.s){g.nativeOnly=true;return;}
  }
  event.preventDefault();event.stopPropagation();
  const d=dx<0?1:-1;if(Math.abs(dx)>4&&d!==g.s.d&&!boundary(g.r,d))installIncoming(g.s,d);
  move(g.s,Math.sign(dx)===-g.s.d?dx:0);
 }
 function end(event){
  if(discardTouch){
   const queued=queuedTouch;queuedTouch=null;discardTouch=false;event.preventDefault();event.stopPropagation();suppressUntil=Date.now()+700;
   const point=event.changedTouches[0];
   if(queued&&point&&queued.moved&&Math.abs(point.clientX-queued.x)>48&&Math.abs(point.clientX-queued.x)>Math.abs(point.clientY-queued.y)*1.3&&!blocked(queued.r)){queueTap(queued.r,point.clientX<queued.x?1:-1,true);return;}
   if(queued&&point&&!queued.moved&&Math.hypot(point.clientX-queued.x,point.clientY-queued.y)<=10&&win.performance.now()-queued.time<450&&!interactiveAt(queued.r,point.clientX,point.clientY)){
    const d=edgeDirection(queued.r,point.clientX);if(d)queueTap(queued.r,d);
   }
   return;
  }
  const g=gesture;gesture=null;scheduleWarm();if(!g)return;
  const point=event.changedTouches[0];if(!point)return;
  if(!g.s){
   const dx=point.clientX-g.x,dy=point.clientY-g.y,moved=Math.hypot(dx,dy)>10;
   if(g.vertical||moved){event.preventDefault();event.stopPropagation();suppressUntil=Date.now()+700;
    if(g.nativeOnly&&!g.vertical&&Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.3&&!blocked(g.r))queueTap(g.r,dx<0?1:-1);
    return;
   }
   if(win.performance.now()-g.time>=450||blocked(g.r)||interactiveAt(g.r,point.clientX,point.clientY))return;
   const d=edgeDirection(g.r,point.clientX);if(!d)return;
   event.preventDefault();event.stopPropagation();suppressUntil=Date.now()+700;queueTap(g.r,d);return;
  }
  event.preventDefault();event.stopPropagation();suppressUntil=Date.now()+800;
  const p=event.changedTouches[0];if(!p||blocked(g.r)){clear();return;}
  const dx=p.clientX-g.x,dy=p.clientY-g.y,now=win.performance.now(),recent=g.trail.find(p=>now-p.time<=100),velocity=recent?(p.clientX-recent.x)/Math.max(1,now-recent.time):0;
  const commit=Math.sign(dx)===-g.s.d&&Math.abs(dx)>Math.abs(dy)*1.3&&(Math.abs(dx)>=Math.min(120,g.s.width*.28)||(Math.abs(dx)>=24&&Math.sign(velocity)===Math.sign(dx)&&Math.abs(velocity)>.5));
  move(g.s,dx);settle(g.s,commit&&!(Math.sign(velocity)!==Math.sign(dx)&&Math.abs(velocity)>.15),{velocity});
 }
 function click(event){
  if(!event.target?.closest?.('.reading-zones'))return;
  if(Date.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();return;}
  const r=root();if(!r||(!busy&&blocked(r)))return;
  const d=edgeDirection(r,event.clientX);if(!d||interactiveAt(r,event.clientX,event.clientY))return;
  event.preventDefault();event.stopImmediatePropagation();queueTap(r,d);
 }
 function key(event){
  if(internal||!['ArrowLeft','ArrowRight','PageUp','PageDown'].includes(event.key)||event.target?.closest?.('input,textarea,select,button,[contenteditable=true]'))return;
  const r=root();if(!enabled(r))return;
  if(busy){event.preventDefault();event.stopImmediatePropagation();return;}
  const d=['ArrowRight','PageDown'].includes(event.key)?1:-1;if(boundary(r,d))return;
  const s=safeSnapshot(r,d);if(!s)return;
  event.preventDefault();event.stopImmediatePropagation();settle(s,true);
 }
 const cancelEvent=()=>cancel();
 const warmingObserver=new win.MutationObserver(records=>{
  if(records.some(record=>!record.target.closest?.('[data-libra-page-turn],[data-libra-preview-probe]')&&!(record.type==='childList'&&[...record.addedNodes,...record.removedNodes].every(n=>n.nodeType===1&&n.matches?.('[data-libra-page-turn],[data-libra-preview-probe]')))))scheduleWarm();
 });warmingObserver.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','data-ready']});scheduleWarm();
 doc.addEventListener('touchstart',start,{capture:true,passive:true});doc.addEventListener('touchmove',drag,{capture:true,passive:false});doc.addEventListener('touchend',end,{capture:true,passive:false});doc.addEventListener('touchcancel',cancelEvent,true);doc.addEventListener('click',click,true);
 win.addEventListener('keydown',key,true);win.addEventListener('resize',cancelEvent);win.addEventListener('pagehide',cancelEvent);doc.addEventListener('visibilitychange',cancelEvent);
 return ()=>{disposed=true;warmingObserver.disconnect();cancel();if(idle)win.cancelIdleCallback?.(idle);if(diagnostics)delete win.libraPageTurnMetrics;win.clearTimeout(warmTimer);win.clearTimeout(queueTimer);style.remove();doc.removeEventListener('touchstart',start,true);doc.removeEventListener('touchmove',drag,true);doc.removeEventListener('touchend',end,true);doc.removeEventListener('touchcancel',cancelEvent,true);doc.removeEventListener('click',click,true);win.removeEventListener('keydown',key,true);win.removeEventListener('resize',cancelEvent);win.removeEventListener('pagehide',cancelEvent);doc.removeEventListener('visibilitychange',cancelEvent);};
}
if(typeof window!=='undefined'&&typeof document!=='undefined')attachPageTurns(window,document);
