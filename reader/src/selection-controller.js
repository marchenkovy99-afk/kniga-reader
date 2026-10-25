/** Word-level mobile selection independent of iOS's native edit menu. */
export function wordBounds(text,offset){
 const words=[...text.matchAll(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)];
 if(!words.length)return null;
 const at=Math.max(0,Math.min(offset,text.length));
 const word=words.find(w=>w.index<=at&&w.index+w[0].length>=at)||words.find(w=>w.index>at)||words.at(-1);
 return {start:word.index,end:word.index+word[0].length};
}
export function createBookSelection(stage,{onSelect,onDismiss=()=>{}}){
 const events=new AbortController(),signal=events.signal;
 let range=null,root=null,gesture=null,timer=null,swallow=false;
 const coarse=matchMedia('(pointer:coarse)').matches;
 if(coarse)stage.classList.add('custom-selection');
 const owner=node=>(node?.nodeType===1?node:node?.parentElement)?.closest('.book-page[aria-hidden="false"] .paragraph');
 const index=(container,node,offset)=>{const r=document.createRange();r.selectNodeContents(container);try{r.setEnd(node,offset);return r.toString().length;}catch{return 0;}};
 function point(container,at){
  const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);let node,last;
  while(node=walker.nextNode()){last=node;if(at<=node.length)return {node,offset:at};at-=node.length;}
  return last?{node:last,offset:last.length}:null;
 }
 function hit(x,y){
  const p=document.caretPositionFromPoint?.(x,y),r=p?null:document.caretRangeFromPoint?.(x,y);
  const node=p?.offsetNode||r?.startContainer,offset=p?.offset??r?.startOffset;
  const paragraph=owner(node);
  if(!paragraph||!stage.contains(paragraph))return null;
  return {node,offset,paragraph,at:index(paragraph,node,offset)};
 }
 const compare=(a,b)=>{const r=document.createRange();r.setStart(a.node,a.offset);r.collapse(true);const s=document.createRange();s.setStart(b.node,b.offset);s.collapse(true);return r.compareBoundaryPoints(Range.START_TO_START,s);};
 function clear(){clearTimeout(timer);timer=null;gesture=null;swallow=false;range=null;root?.remove();root=null;stage.classList.remove('selection-active');onDismiss();}
 function draw(showMenu=true){
  if(!range||range.collapsed)return;
  const rects=[...range.getClientRects()].filter(r=>r.width>.1&&r.height>.1);
  if(!rects.length){clear();return;}
  if(!root){root=document.createElement('div');root.id='quote-selection';document.body.append(root);}
  root.querySelectorAll('.selection-fill').forEach(el=>el.remove());
  for(const rect of rects){const span=document.createElement('span');span.className='selection-fill';span.style.cssText=`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;root.append(span);}
  const first=rects[0],last=rects.at(-1);
  for(const [edge,x,y] of [['start',first.left,first.top],['end',last.right,last.bottom]]){
   let handle=root.querySelector(`[data-selection-handle="${edge}"]`);
   if(!handle){handle=document.createElement('button');handle.type='button';handle.className='selection-handle '+edge;handle.dataset.selectionHandle=edge;handle.setAttribute('aria-label',edge==='start'?'Начало выделения':'Конец выделения');
   handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();const node=edge==='start'?range.startContainer:range.endContainer,at=edge==='start'?range.startOffset:range.endOffset;const paragraph=owner(node),local=index(paragraph,node,at),bounds=wordBounds(paragraph.textContent,local+(e.key==='ArrowRight'?1:-1)),next=bounds&&point(paragraph,e.key==='ArrowRight'?bounds.end:bounds.start);if(next)resize(edge,next,true);};
   root.append(handle);}
   handle.style.cssText=`left:${x}px;top:${y}px`;
  }
  stage.classList.add('selection-active');
  if(showMenu)onSelect(range.cloneRange());
 }
 function resize(edge,p,showMenu=false){
  const fixed=edge==='start'?{node:range.endContainer,offset:range.endOffset}:{node:range.startContainer,offset:range.startOffset};
  // Keep handles ordered; crossing clamps to a word instead of flipping the UI.
  if(edge==='start'&&compare(p,fixed)<0)range.setStart(p.node,p.offset);
  if(edge==='end'&&compare(p,fixed)>0)range.setEnd(p.node,p.offset);
  draw(showMenu);
 }
 function selectWord(p){
  const bounds=wordBounds(p.paragraph.textContent,p.at);if(!bounds)return false;
  const a=point(p.paragraph,bounds.start),b=point(p.paragraph,bounds.end);if(!a||!b)return false;
  range=document.createRange();range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);
  window.getSelection()?.removeAllRanges();draw(false);return true;
 }
 document.addEventListener('pointerdown',event=>{
  if(event.isPrimary===false||event.button>0)return;
  const handle=event.target.closest?.('[data-selection-handle]');
  if(handle&&range){
   event.preventDefault();gesture={id:event.pointerId,kind:'handle',edge:handle.dataset.selectionHandle};onDismiss();swallow=true;
   const rect=range.getClientRects();const r=handle.dataset.selectionHandle==='start'?rect[0]:rect[rect.length-1];gesture.dy=(handle.dataset.selectionHandle==='start'?r.top+r.height/2:r.top+r.height/2)-event.clientY;
   return;
  }
  if(event.target.closest?.('#quote-actions'))return;
  if(range){clear();swallow=true;gesture={id:event.pointerId,kind:'dismiss'};return;}
  if(!coarse||!event.target.closest?.('.book-text')||!stage.contains(event.target)||event.target.closest('a,[data-note],input,textarea'))return;
  const p=hit(event.clientX,event.clientY);if(!p)return;
  gesture={id:event.pointerId,kind:'press',x:event.clientX,y:event.clientY,p};
  timer=setTimeout(()=>{timer=null;if(gesture?.kind==='press'&&selectWord(p)){gesture.kind='select';swallow=true;}},420);
 },{capture:true,signal});
 document.addEventListener('pointermove',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  if(gesture.kind==='dismiss')return;
  if(gesture.kind==='press'){
   if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>12){clearTimeout(timer);timer=null;gesture=null;}return;
  }
  event.preventDefault();const p=hit(event.clientX,event.clientY+(gesture.dy||0));if(!p)return;
  const bounds=wordBounds(p.paragraph.textContent,p.at);if(!bounds)return;
  const edge=gesture.kind==='select'?'end':gesture.edge;
  resize(edge,point(p.paragraph,edge==='start'?bounds.start:bounds.end));
 },{capture:true,passive:false,signal});
 const finish=event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  clearTimeout(timer);timer=null;const wasSelection=gesture.kind!=='press';gesture=null;
  if(wasSelection){swallow=true;draw(true);setTimeout(()=>{swallow=false;},0);}
 };
 document.addEventListener('pointerup',finish,{capture:true,signal});
 document.addEventListener('pointercancel',event=>{if(gesture?.id!==event.pointerId)return;clearTimeout(timer);gesture=null;if(range)draw(true);swallow=false;},{capture:true,signal});
 document.addEventListener('click',event=>{if(range&&stage.contains(event.target)){event.preventDefault();event.stopPropagation();}},{capture:true,signal});
 stage.addEventListener('contextmenu',event=>{if(coarse&&event.target.closest?.('.book-text'))event.preventDefault();},{signal});
 window.addEventListener('resize',()=>{if(range)draw(true);},{signal});
 return {get active(){return !!range||swallow||gesture?.kind==='select'||gesture?.kind==='handle';},clear,destroy(){clear();events.abort();stage.classList.remove('custom-selection');}};
}
