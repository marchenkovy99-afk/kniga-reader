import {createTextIndex,findMatches,normalizeText,matchTarget} from './book-search-core.js';

const icons={search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',right:'<path d="m9 5 7 7-7 7"/>'};
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
function icon(name){const span=el('span','book-search-icon');span.innerHTML=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;return span;}
function button(label,name,action){const node=el('button','',name?undefined:label);node.type='button';node.setAttribute('aria-label',label);if(name)node.append(icon(name));node.addEventListener('click',action);return node;}
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
async function until(predicate,signal){const start=performance.now();for(;;){signal?.throwIfAborted();if(predicate())return;if(performance.now()-start>12000)throw Error('Не удалось перейти к найденному месту');await frame();}}
const adapter=root=>root.querySelector('.reading-content .page-viewport')?.libraFb2Preview||root.querySelector('.reading-content .epub-mount')?.libraEpubPreview;
function textPoint(block,offset){const walker=block.ownerDocument.createTreeWalker(block,4);let node,last;while(node=walker.nextNode()){last=node;if(offset<=node.length)return {node,offset};offset-=node.length;}return last?{node:last,offset:last.length}:null;}
function matchBlock(flow,unit){const block=flow.querySelector(`[data-block-index="${unit.block}"]`);return unit.cell===undefined?block:block?.querySelectorAll('td')[unit.cell]||block;}
function fb2Range(root,match){const flow=root.querySelector('.reading-content .book-flow'),doc=root.ownerDocument;if(!flow)return null;let a=matchBlock(flow,match.first.unit),b=matchBlock(flow,match.last.unit);const table=root.querySelector('.book-table-panel table');if(table&&match.first.unit.cell!==undefined){a=table.querySelectorAll('td')[match.first.unit.cell];b=table.querySelectorAll('td')[match.last.unit.cell];}if(!a||!b)return null;const first=textPoint(a,match.first.offset),last=textPoint(b,match.last.offset);if(!first||!last)return null;const range=doc.createRange();range.setStart(first.node,first.offset);range.setEnd(last.node,last.offset);return range;}
function domUnits(doc){
 const units=[];let boundary=false;
 const blocks=/^(p|div|section|article|h[1-6]|li|tr|td|blockquote|br)$/;
 function walk(node){
  if(node.nodeType===3){if(node.textContent){units.push({text:node.textContent,node,separatorBefore:boundary?' ':''});boundary=false;}return;}
  if(node.nodeType!==1||/^(script|style|noscript|svg|math)$/i.test(node.localName)||node.hasAttribute('hidden'))return;
  const block=blocks.test(node.localName);if(block)boundary=true;for(const child of node.childNodes)walk(child);if(block)boundary=true;
 }
 walk(doc.body||doc.querySelector('body')||doc.documentElement);return units;
}
function matchRange(match){const doc=match.first.unit.node.ownerDocument,range=doc.createRange();range.setStart(match.first.unit.node,match.first.offset);range.setEnd(match.last.unit.node,match.last.offset);return range;}

export function installBookSearch(root){
 if(root.dataset.bookSearchInstalled)return ()=>{};root.dataset.bookSearchInstalled='true';
 let query='',matches=[],active=-1,generation=0,indexes=null,indexing=null,indexController=null,panel=null,panelSnapshot=null,nav=null,origin=null,timer,disposed=false,navigating=false,navVersion=0,highlight=null,manualReading=false,manualOrigin=null;
 const lifetime=new AbortController();let inert=[];
 const tool=button('Поиск по книге','search',()=>open());tool.className='book-search-launch';tool.append(document.createTextNode('Поиск'));root.querySelector('.reading-tools')?.append(tool);
 const setNavigating=value=>{navigating=value;tool.disabled=value;if(value)root.dataset.searchNavigating='true';else delete root.dataset.searchNavigating;};
 const clearHighlight=()=>{highlight?.remove();highlight=null;};
 const clearInert=()=>{for(const [node,old]of inert)node.inert=old;inert=[];};
 function lock(){clearInert();for(const node of root.children){if(node===panel||node===nav)continue;inert.push([node,node.inert]);node.inert=true;}}
 const focusTool=()=>{
  let attempts=0;
  const focus=()=>{if(disposed||panel)return;const target=root.querySelector('.reading-tools .book-search-launch');if(!target)return;if(root.ownerDocument.defaultView.getComputedStyle(target).visibility==='visible'){target.focus({preventScroll:true});if(document.activeElement===target)return;}if(++attempts<24)setTimeout(focus,20);else root.querySelector('.reading-status')?.focus({preventScroll:true});};
  requestAnimationFrame(focus);
 };
 function closePanel(){clearTimeout(timer);generation++;indexController?.abort();indexController=null;indexing=null;panel?.remove();panel=null;panelSnapshot=null;root.classList.remove('book-search-open');clearInert();}
 function cancelPanel(){const snapshot=panelSnapshot;closePanel();if(snapshot){query=snapshot.query;matches=snapshot.matches;active=snapshot.active;updateNav();nav?.querySelector('button')?.focus({preventScroll:true});}else{origin=null;focusTool();}}
 function closeAll(focus=true){navVersion++;closePanel();nav?.remove();nav=null;clearHighlight();root.classList.remove('book-search-browsing');origin=null;active=-1;matches=[];query='';indexes=null;indexing=null;manualReading=false;manualOrigin=null;if(focus)focusTool();}
 async function ready(version=navVersion){
  let last='',stable=0;
  await until(()=>{
   if(disposed||version!==navVersion)throw new DOMException('Search navigation cancelled','AbortError');
   const api=adapter(root),view=root.querySelector('.reading-content .page-viewport,.reading-content .epub-mount');
   if(!api||!view||api.settled?.()===false){stable=0;return false;}
   const state=api.state(),geometry=state.geometry||state;
   if(geometry.height!==undefined&&Math.abs(geometry.height-view.clientHeight)>1||geometry.width!==undefined&&Math.abs(geometry.width-view.clientWidth)>1){stable=0;return false;}
   const key=[state.key,state.chapter,view.clientWidth,view.clientHeight].join(':');
   stable=key===last?stable+1:0;last=key;return stable>=3;
  },lifetime.signal);
 }
 const targetFor=matchTarget;
 function readPosition(){
  const api=adapter(root),position=api?.position?.();if(!api?.safe?.())return position;
  const flow=root.querySelector('.reading-content .book-flow'),view=root.querySelector('.reading-content .page-viewport');if(!flow||!view)return position;
  const bounds=view.getBoundingClientRect(),walker=root.ownerDocument.createTreeWalker(flow,4),offsets=new Map();let node;
  while(node=walker.nextNode()){
   const block=node.parentElement?.closest('[data-block-index]');if(!block||!node.length)continue;
   const prefix=offsets.get(block)||0;offsets.set(block,prefix+node.length);
   const range=root.ownerDocument.createRange();range.selectNodeContents(node);
   if(![...range.getClientRects()].some(r=>r.bottom>bounds.top&&r.top<bounds.bottom))continue;
   let lo=0,hi=node.length-1;while(lo<hi){const mid=(lo+hi)>>1;range.setStart(node,mid);range.setEnd(node,mid+1);if(range.getBoundingClientRect().bottom<=bounds.top)lo=mid+1;else hi=mid;}
   return {...position,anchor:{block:Number(block.dataset.blockIndex),textNode:0,offset:prefix+lo}};
  }
  return position;
 }
 function sourceRange(position){
  if(position.cfi)return adapter(root)?.state().rendition?.getRange(position.cfi);
  const a=position.anchor,block=a&&root.querySelector(`.reading-content .book-flow [data-block-index="${a.block}"]`);if(!block)return null;
  const range=root.ownerDocument.createRange();if(a.textNode===-1){range.selectNode(block);return range;}
  let point;if(a.textNode===0)point=textPoint(block,a.offset);else{const walker=root.ownerDocument.createTreeWalker(block,4);let node,index=0;while(node=walker.nextNode())if(index++===a.textNode){point={node,offset:Math.min(a.offset,node.length)};break;}}
  if(!point?.node.length)return null;const offset=Math.min(point.offset,point.node.length-1);range.setStart(point.node,offset);range.setEnd(point.node,offset+1);return range;
 }
 function rangeVisible(range){
  if(!range)return false;const view=root.querySelector('.reading-content .page-viewport,.reading-content .epub-mount')?.getBoundingClientRect();if(!view)return false;
  const box=range.startContainer.ownerDocument.defaultView?.frameElement?.getBoundingClientRect(),x=box?.left||0,y=box?.top||0;
  return [...range.getClientRects()].some(r=>r.width>0&&r.height>0&&r.right+x>view.left&&r.left+x<view.right&&r.bottom+y>view.top&&r.top+y<view.bottom);
 }

 async function buildIndexes(){
  if(indexes)return indexes;if(indexing)return indexing;
  const controller=new AbortController();indexController=controller;const signal=controller.signal;
  const cancel=()=>controller.abort();lifetime.signal.addEventListener('abort',cancel,{once:true});
  indexing=(async()=>{
   await until(()=>{const api=adapter(root);return api&&(api.chapters?api.chapters().length>0:api.state()?.book);},signal);
   const api=adapter(root),state=api?.state();if(!state)throw Error('Книга ещё открывается');const output=[];
   if(api.chapters){
    for(const [chapter,item]of api.chapters().entries()){
     signal.throwIfAborted();const units=item.blocks.flatMap((b,block)=>b.kind==='table'?b.rows.flat().map((text,cell)=>({text,block,cell})):[{text:b.inline?.map(r=>r.text).join('')??b.text??'',block}]);output.push({chapter,title:item.title||`Глава ${chapter+1}`,index:createTextIndex(units)});await frame();
    }
   }else{
    const book=state.book;await book.ready;
    for(const section of book.spine.spineItems){
     signal.throwIfAborted();
     // Detached XML: use the book's existing archive loader and content safety
     // hooks, without loading/unloading a live rendition's section.
     const doc=await book.load(section.url);signal.throwIfAborted();await book.spine.hooks.content.trigger(doc,section);signal.throwIfAborted();
     const title=doc.querySelector('h1,h2,title')?.textContent?.trim()||`Глава ${section.index+1}`;
     output.push({chapter:section.index,title,index:createTextIndex(domUnits(doc)),section});await frame();
    }
   }
   signal.throwIfAborted();if(disposed)return [];indexes=output;return output;
  })().finally(()=>{lifetime.signal.removeEventListener('abort',cancel);if(indexController===controller){indexController=null;indexing=null;}});return indexing;
 }
 function status(text){if(!panel)return;panel.querySelector('.book-search-count').textContent=text;}
 function snippet(entry,match){
  const p=el('p','book-search-snippet'),text=entry.index.text,start=Math.max(0,match.start-65),end=Math.min(text.length,match.end+95);
  p.append(document.createTextNode((start?'…':'')+text.slice(start,match.start)));p.append(el('mark','',text.slice(match.start,match.end)));p.append(document.createTextNode(text.slice(match.end,end)+(end<text.length?'…':'')));return p;
 }
 async function search(){
  if(!panel)return;const current=++generation;query=panel.querySelector('input').value;const results=panel.querySelector('.book-search-results');results.replaceChildren();
  if(!normalizeText(query).value){matches=[];status('');results.removeAttribute('aria-busy');results.append(el('p','book-search-empty','Слово, фраза или целое предложение'));return;}
  status('Ищем по книге…');results.setAttribute('aria-busy','true');
  try{
   const entries=await buildIndexes();if(current!==generation||!panel)return;const found=[];let capped=false;
   for(const entry of entries){
    if(current!==generation||disposed)return;
    const hits=findMatches(entry.index,query,{limit:10001-found.length,signal:lifetime.signal});
    for(const match of hits){if(found.length>=10000){capped=true;break;}const cfi=entry.section?entry.section.cfiFromRange(matchRange(match)):null;found.push({...match,chapter:entry.chapter,title:entry.title,entry,cfi});}
    if(capped)break;await frame();
   }
   if(current!==generation||!panel)return;matches=found;active=-1;
   status(found.length?`Найдено: ${found.length}${capped?'+':''}`:'Ничего не найдено');results.removeAttribute('aria-busy');
   if(!found.length){results.append(el('p','book-search-empty','Попробуй другое слово или более короткую фразу.'));return;}
   let rendered=0;const more=button('Показать ещё',null,()=>appendRows());more.className='book-search-more';
   function appendRows(){if(current!==generation||!panel)return;more.remove();const fragment=document.createDocumentFragment(),end=Math.min(rendered+50,found.length);for(;rendered<end;rendered++){const number=rendered,match=found[number],row=button(`Перейти к совпадению ${number+1}`,null,()=>{if(current===generation&&matches===found)go(number);});row.className='book-search-result';row.replaceChildren(el('span','book-search-chapter',match.title),snippet(match.entry,match),icon('right'));fragment.append(row);}results.append(fragment);if(rendered<found.length)results.append(more);}
   appendRows();
  }catch(error){if(current===generation&&panel){status('Не удалось выполнить поиск');results.removeAttribute('aria-busy');results.append(el('p','book-search-empty','Закрой поиск и попробуй ещё раз.'));console.error('Libra search:',error);}}
 }
 function open(){
  if(disposed||panel||navigating)return;const api=adapter(root);if(!api)return;
  if(!origin)origin=readPosition()||api.state().rendition?.currentLocation()?.start?.cfi;
  root.querySelector('.sheet-scrim:not(.sheet-exiting) [aria-label="Закрыть"]')?.click();
  panelSnapshot=nav?{query,matches,active}:null;
  panel=el('section','book-search-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','book-search-title');
  const header=el('header','book-search-header'),title=el('h2','', 'Поиск по книге');title.id='book-search-title';header.append(title,button('Закрыть поиск','close',cancelPanel));
  const bookTitle=el('p','book-search-book',root.querySelector('.reading-title')?.textContent?.trim()||'');
  const form=el('form','book-search-field'),input=el('input');input.type='search';input.setAttribute('aria-label','Слово, фраза или предложение');input.placeholder='Найти в книге';input.autocomplete='off';input.spellcheck=false;input.value=query;
  const clear=button('Очистить поиск','close',()=>{input.value='';input.focus();search();});clear.hidden=!query;
  form.append(icon('search'),input,clear);form.addEventListener('submit',event=>{event.preventDefault();clearTimeout(timer);input.blur();search();});input.addEventListener('input',()=>{clear.hidden=!input.value;clearTimeout(timer);generation++;panel.querySelector('.book-search-results').replaceChildren();status(normalizeText(input.value).value?'Ищем по книге…':'');timer=setTimeout(search,180);});
  const count=el('p','book-search-count');count.setAttribute('role','status');count.setAttribute('aria-live','polite');const list=el('div','book-search-results');
  panel.append(header,bookTitle,form,count,list);root.append(panel);root.classList.add('book-search-open');lock();
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();panel.querySelector('[aria-label="Закрыть поиск"]').click();}if(event.key==='Tab'){const items=[...panel.querySelectorAll('button:not(:disabled):not([hidden]),input')],first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  input.focus({preventScroll:true});search();
 }
 function paint(match){
  clearHighlight();let range,offsetX=0,offsetY=0;
  if(match.cfi){const state=adapter(root)?.state();range=state?.rendition.getRange(match.cfi);if(!range)return;const frame=range.startContainer.ownerDocument.defaultView?.frameElement,box=frame?.getBoundingClientRect();offsetX=box?.left||0;offsetY=box?.top||0;}else range=fb2Range(root,match);
  if(!range)return;const rootBox=root.getBoundingClientRect(),view=(root.querySelector('.book-table-scroll')||root.querySelector('.reading-content .page-viewport,.reading-content .epub-mount'))?.getBoundingClientRect();
  highlight=el('div','book-search-highlights');highlight.dataset.searchHighlight='';highlight.setAttribute('aria-hidden','true');
  for(const rect of range.getClientRects()){const x=rect.left+offsetX,y=rect.top+offsetY;if(!view||rect.width<=0||rect.height<=0||x+rect.width<=view.left||x>=view.right||y+rect.height<=view.top||y>=view.bottom)continue;const item=el('i');Object.assign(item.style,{left:Math.max(x,view.left)-rootBox.left+'px',top:Math.max(y,view.top)-rootBox.top+'px',width:Math.max(0,Math.min(x+rect.width,view.right)-Math.max(x,view.left))+'px',height:Math.max(0,Math.min(y+rect.height,view.bottom)-Math.max(y,view.top))+'px'});highlight.append(item);}root.append(highlight);return highlight.childElementCount;
 }
 function showNav(){
  if(nav)return;nav=el('div','book-search-nav');nav.setAttribute('role','region');nav.setAttribute('aria-label','Совпадения в книге');const bar=el('div','book-search-nav-bar'),label=button('Показать результаты поиска','search',open);label.className='book-search-query';label.append(el('span','',query));const count=el('output');count.setAttribute('aria-live','polite');
  bar.append(label,count,button('Предыдущее совпадение','up',()=>go(active-1)),button('Следующее совпадение','down',()=>go(active+1)),button('Завершить поиск','close',finishSearch));
  const back=button('Вернуться к исходному месту',null,async()=>{if(navigating)return;const target=origin;setNavigating(true);closeAll(false);try{await ready();await restore(target);focusTool();}catch(error){if(!disposed&&error.name!=='AbortError'){setNavigating(false);open();status('Не удалось вернуться. Попробуй ещё раз.');console.error(error);}}finally{setNavigating(false);updateNav();}});back.textContent='Вернуться';back.className='book-search-return';nav.append(bar,back);root.append(nav);
 }
 function updateNav(){if(!nav)return;nav.querySelector('.book-search-query>span:last-child').textContent=query;nav.querySelector('output').textContent=`${active+1} / ${matches.length}`;nav.querySelector('[aria-label="Предыдущее совпадение"]').disabled=navigating||active<=0;nav.querySelector('[aria-label="Следующее совпадение"]').disabled=navigating||active>=matches.length-1;nav.querySelector('.book-search-return').disabled=navigating;nav.querySelector('[aria-label="Завершить поиск"]').disabled=navigating;nav.querySelector('[aria-label="Показать результаты поиска"]').disabled=navigating;}
 async function finishSearch(){
  if(navigating)return;setNavigating(true);
  try{
   await ready();const current=readPosition();resolveManual(current);
   const selected=!manualReading&&matches[active]?targetFor(matches[active]):current;
   closeAll(false);await restore(selected);focusTool();
  }catch(error){if(!disposed&&error.name!=='AbortError'){setNavigating(false);open();status('Не удалось сохранить место. Повтори переход.');console.error('Libra search close:',error);}}
  finally{setNavigating(false);updateNav();}
 }

 async function restore(position){
  if(!position)return;await ready();const api=adapter(root),version=navVersion;
  if(api.seek){
   const result=await api.seek(position);await ready(version);
   await until(()=>{const state=adapter(root)?.state();return state?.chapter===position.chapter&&(position.anchor||state.page===(result??position.page))&&adapter(root)?.settled();},lifetime.signal);
   if(adapter(root)?.safe?.()&&position.anchor){const view=root.querySelector('.reading-content .page-viewport'),range=sourceRange(position);if(range)view.scrollTop+=range.getBoundingClientRect().top-view.getBoundingClientRect().top;await frame();}
  }else{await api.navigate(typeof position==='string'?position:position.cfi);await ready(version);}
  const exact=typeof position==='string'?{cfi:position}:position;
  if((exact.anchor||exact.cfi)&&!rangeVisible(sourceRange(exact)))throw Error('Не удалось показать выбранный текст');
  await adapter(root)?.save?.({...readPosition(),...exact});
 }

 async function locate(match){
  await restore(targetFor(match));
  if(match.first.unit.cell!==undefined){
   const launch=root.querySelector(`.reading-content .book-flow [data-block-index="${match.first.unit.block}"].book-table-launch`);
   if(launch){launch.click();await frame();const cell=root.querySelectorAll('.book-table-panel td')[match.first.unit.cell],scroll=root.querySelector('.book-table-scroll');if(cell&&scroll)scroll.scrollTop=Math.max(0,cell.offsetTop-scroll.clientHeight/3);}
  }
  if(!paint(match))throw Error('Найденный текст ещё не появился на странице');
 }
 async function go(number){
  if(navigating||number<0||number>=matches.length)return;
  root.querySelector('.book-table-panel header button')?.click();setNavigating(true);const version=++navVersion,match=matches[number];
  closePanel();root.classList.add('book-search-browsing');showNav();updateNav();clearHighlight();
  try{
   await ready(version);await locate(match);
   if(disposed||version!==navVersion)return;
   active=number;manualReading=false;manualOrigin=null;
   nav.querySelector('[aria-label="Показать результаты поиска"]')?.focus({preventScroll:true});
  }catch(error){if(!disposed&&version===navVersion&&error.name!=='AbortError'){setNavigating(false);open();status('Не удалось перейти. Попробуй ещё раз.');console.error('Libra search navigation:',error);}}
  finally{setNavigating(false);updateNav();}
 }
 let resizePending=false,repairing=false;
 function onResize(){
  if(disposed||active<0||!nav||panel)return;
  clearHighlight();resizePending=true;if(repairing||disposed)return;repairing=true;
  (async()=>{
   while(resizePending&&!disposed){
    resizePending=false;await ready();
    if(navigating){await frame();resizePending=true;continue;}
    if(active<0||panel||!nav)continue;
    resolveManual(readPosition());if(manualReading){paint(matches[active]);continue;}
    setNavigating(true);updateNav();
    try{await locate(matches[active]);}finally{setNavigating(false);updateNav();}
   }
  })().catch(error=>{if(!disposed&&error.name!=='AbortError'){setNavigating(false);open();status('Страница изменилась. Выбери совпадение ещё раз.');console.error('Libra search resize:',error);}}).finally(()=>{repairing=false;});
 }
 window.addEventListener('resize',onResize);
 const Resize=root.ownerDocument.defaultView.ResizeObserver;
 const observer=Resize?new Resize(onResize):null;
 const viewport=root.querySelector('.reading-content .page-viewport,.reading-content .epub-mount');if(viewport)observer?.observe(viewport);
 root.ownerDocument.fonts?.addEventListener('loadingdone',onResize);
 window.visualViewport?.addEventListener('resize',onResize);
 const samePosition=(a,b)=>a&&b&&(Number.isInteger(a.chapter)&&Number.isInteger(b.chapter)&&!root.matches('.reading-scroll-safe')?a.chapter===b.chapter&&a.page===b.page:a.cfi===b.cfi);
 function resolveManual(current){if(manualOrigin){manualReading=manualReading||!samePosition(manualOrigin,current);manualOrigin=null;}}
 const recordManual=()=>{if(!panel&&!navigating&&!manualOrigin)manualOrigin=readPosition();};
 const edge=(target,x)=>{const box=target.getBoundingClientRect(),bounds=box.width?box:root.getBoundingClientRect(),ratio=(x-bounds.left)/bounds.width;return ratio<.28||ratio>.72;};
 const onReading=event=>{const zone=event.target.closest?.('.reading-zones');if(zone&&edge(zone,event.clientX)||event.target.matches?.('input[type="range"]'))recordManual();};
 let touch=null;
 const onTouchStart=event=>{const zone=event.target.closest?.('.reading-zones'),p=event.touches?.[0];touch=zone&&p?{zone,x:p.clientX,y:p.clientY}:null;};
 const onTouchEnd=event=>{const p=event.changedTouches?.[0],start=touch;touch=null;if(!p||!start)return;const dx=p.clientX-start.x,dy=p.clientY-start.y;if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)||Math.abs(dx)<8&&Math.abs(dy)<8&&edge(start.zone,start.x))recordManual();};
 const onKey=event=>{if(['ArrowLeft','ArrowRight','PageUp','PageDown'].includes(event.key)&&!event.target.closest?.('input,textarea,select'))recordManual();};
 const onScroll=event=>{if(!navigating&&adapter(root)?.safe?.()&&event.target.matches?.('.page-viewport')){manualReading=true;clearHighlight();}};
 root.addEventListener('touchstart',onTouchStart,{passive:true,capture:true});root.addEventListener('touchend',onTouchEnd,true);root.addEventListener('touchcancel',onTouchEnd,true);root.addEventListener('click',onReading,true);root.addEventListener('input',onReading,true);root.addEventListener('scroll',onScroll,true);root.ownerDocument.addEventListener('keydown',onKey,true);

 return ()=>{disposed=true;lifetime.abort();clearTimeout(timer);closeAll(false);tool.remove();window.removeEventListener('resize',onResize);observer?.disconnect();root.ownerDocument.fonts?.removeEventListener('loadingdone',onResize);window.visualViewport?.removeEventListener('resize',onResize);root.ownerDocument.removeEventListener('keydown',onKey,true);root.removeEventListener('touchstart',onTouchStart,true);root.removeEventListener('touchend',onTouchEnd,true);root.removeEventListener('touchcancel',onTouchEnd,true);root.removeEventListener('click',onReading,true);root.removeEventListener('input',onReading,true);root.removeEventListener('scroll',onScroll,true);delete root.dataset.bookSearchInstalled;};
}

let installedRoot,cleanup;const observe=new MutationObserver(()=>{const root=document.querySelector('.reading-root');if(root===installedRoot)return;cleanup?.();installedRoot=root;cleanup=root?installBookSearch(root):null;});
observe.observe(document.documentElement,{childList:true,subtree:true});
