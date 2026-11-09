import {createTextIndex,findMatches,normalizeText} from './book-search-core.js';

const icons={search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',right:'<path d="m9 5 7 7-7 7"/>'};
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
function icon(name){const span=el('span','book-search-icon');span.innerHTML=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;return span;}
function button(label,name,action){const node=el('button','',name?undefined:label);node.type='button';node.setAttribute('aria-label',label);if(name)node.append(icon(name));node.addEventListener('click',action);return node;}
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
async function until(predicate,signal){const start=performance.now();while(!predicate()){signal?.throwIfAborted();if(performance.now()-start>12000)throw Error('Не удалось перейти к найденному месту');await frame();}}
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
 let query='',matches=[],active=-1,generation=0,indexes=null,indexing=null,indexController=null,panel=null,panelSnapshot=null,nav=null,origin=null,timer,disposed=false,navigating=false,navVersion=0,highlight=null;
 const lifetime=new AbortController();let inert=[];
 const tool=button('Поиск по книге','search',()=>open());tool.className='book-search-launch';tool.append(document.createTextNode('Поиск'));root.querySelector('.reading-tools')?.append(tool);
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
 function closeAll(focus=true){navVersion++;closePanel();nav?.remove();nav=null;clearHighlight();root.classList.remove('book-search-browsing');origin=null;active=-1;matches=[];query='';indexes=null;indexing=null;if(focus)focusTool();}
 async function buildIndexes(){
  if(indexes)return indexes;if(indexing)return indexing;
  const controller=new AbortController();indexController=controller;const signal=controller.signal;
  const cancel=()=>controller.abort();lifetime.signal.addEventListener('abort',cancel,{once:true});
  indexing=(async()=>{
   const api=adapter(root),state=api?.state();if(!state)throw Error('Книга ещё открывается');const output=[];
   if(api.chapters){
    for(const [chapter,item]of api.chapters().entries()){
     signal.throwIfAborted();const units=item.blocks.flatMap((b,block)=>b.kind==='table'?b.rows.flat().map((text,cell)=>({text,block,cell})):[{text:b.inline?.map(r=>r.text).join('')??b.text??'',block}]);output.push({chapter,title:item.title||`Глава ${chapter+1}`,index:createTextIndex(units)});await frame();
    }
   }else{
    const book=state.book;await book.ready;
    for(const section of book.spine.spineItems){
     signal.throwIfAborted();if(section.linear==='no')continue;
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
  if(!normalizeText(query).value){matches=[];status('');results.append(el('p','book-search-empty','Слово, фраза или целое предложение'));return;}
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
   function appendRows(){more.remove();const fragment=document.createDocumentFragment(),end=Math.min(rendered+50,found.length);for(;rendered<end;rendered++){const number=rendered,match=found[number],row=button(`Перейти к совпадению ${number+1}`,null,()=>go(number));row.className='book-search-result';row.replaceChildren(el('span','book-search-chapter',match.title),snippet(match.entry,match),icon('right'));fragment.append(row);}results.append(fragment);if(rendered<found.length)results.append(more);}
   appendRows();
  }catch(error){if(current===generation&&panel){status('Не удалось выполнить поиск');results.removeAttribute('aria-busy');results.append(el('p','book-search-empty','Закрой поиск и попробуй ещё раз.'));console.error('Libra search:',error);}}
 }
 function open(){
  if(disposed||panel)return;const api=adapter(root);if(!api)return;
  if(!origin)origin=api.position?.()||api.state().rendition?.currentLocation()?.start?.cfi;
  root.querySelector('.sheet-scrim:not(.sheet-exiting) [aria-label="Закрыть"]')?.click();
  panelSnapshot=nav?{query,matches,active}:null;
  panel=el('section','book-search-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','book-search-title');
  const header=el('header','book-search-header'),title=el('h2','', 'Поиск по книге');title.id='book-search-title';header.append(title,button('Закрыть поиск','close',cancelPanel));
  const bookTitle=el('p','book-search-book',root.querySelector('.reading-title')?.textContent?.trim()||'');
  const form=el('form','book-search-field'),input=el('input');input.type='search';input.setAttribute('aria-label','Слово, фраза или предложение');input.placeholder='Найти в книге';input.autocomplete='off';input.spellcheck=false;input.value=query;
  const clear=button('Очистить поиск','close',()=>{input.value='';input.focus();search();});clear.hidden=!query;
  form.append(icon('search'),input,clear);form.addEventListener('submit',event=>{event.preventDefault();input.blur();search();});input.addEventListener('input',()=>{clear.hidden=!input.value;clearTimeout(timer);generation++;timer=setTimeout(search,180);});
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
  for(const rect of range.getClientRects()){const x=rect.left+offsetX,y=rect.top+offsetY;if(!view||x+rect.width<view.left||x>view.right||y+rect.height<view.top||y>view.bottom)continue;const item=el('i');Object.assign(item.style,{left:Math.max(x,view.left)-rootBox.left+'px',top:Math.max(y,view.top)-rootBox.top+'px',width:Math.max(0,Math.min(x+rect.width,view.right)-Math.max(x,view.left))+'px',height:Math.max(0,Math.min(y+rect.height,view.bottom)-Math.max(y,view.top))+'px'});highlight.append(item);}root.append(highlight);
 }
 function showNav(){
  if(nav)return;nav=el('div','book-search-nav');nav.setAttribute('role','region');nav.setAttribute('aria-label','Совпадения в книге');const bar=el('div','book-search-nav-bar'),label=button('Показать результаты поиска','search',open);label.className='book-search-query';label.append(el('span','',query));const count=el('output');count.setAttribute('aria-live','polite');
  bar.append(label,count,button('Предыдущее совпадение','up',()=>go(active-1)),button('Следующее совпадение','down',()=>go(active+1)),button('Завершить поиск','close',()=>closeAll()));
  const back=button('Вернуться к чтению',null,async()=>{if(navigating)return;const target=origin;closeAll(false);await frame();await frame();try{await restore(target);focusTool();}catch(error){console.error(error);}});back.className='book-search-return';nav.append(bar,back);root.append(nav);
 }
 function updateNav(){if(!nav)return;nav.querySelector('.book-search-query>span:last-child').textContent=query;nav.querySelector('output').textContent=`${active+1} / ${matches.length}`;nav.querySelector('[aria-label="Предыдущее совпадение"]').disabled=navigating||active<=0;nav.querySelector('[aria-label="Следующее совпадение"]').disabled=navigating||active>=matches.length-1;nav.querySelector('.book-search-return').disabled=navigating;nav.querySelector('[aria-label="Завершить поиск"]').disabled=navigating;nav.querySelector('[aria-label="Показать результаты поиска"]').disabled=navigating;}
 async function restore(position){const api=adapter(root);if(!api||!position)return;if(api.seek){await until(()=>{const view=root.querySelector('.reading-content .page-viewport'),api=adapter(root);return view&&api?.settled()&&Math.abs(api.state().height-view.clientHeight)<1;},lifetime.signal);await adapter(root).seek(position);await until(()=>{const current=adapter(root)?.state();return current?.chapter===position.chapter&&current.page===position.page&&adapter(root)?.settled();},lifetime.signal);}else await api.navigate(typeof position==='string'?position:position.cfi);}
 async function go(number){
  if(navigating||number<0||number>=matches.length)return;root.querySelector('.book-table-panel header button')?.click();navigating=true;const version=++navVersion,match=matches[number];
  closePanel();root.classList.add('book-search-browsing');showNav();updateNav();clearHighlight();
  try{
   await frame();await frame();lifetime.signal.throwIfAborted();let api=adapter(root);
   if(match.cfi)await api.navigate(match.cfi);
   else{
    // Measure a detached chapter at current geometry; never estimate a page
    // number from character count, and never edit the reader's text DOM.
    await until(()=>{const view=root.querySelector('.reading-content .page-viewport'),api=adapter(root);return view&&api?.settled()&&Math.abs(api.state().height-view.clientHeight)<1;},lifetime.signal);api=adapter(root);const state=api.state(),host=el('div','book-search-probe');host.inert=true;host.setAttribute('aria-hidden','true');Object.assign(host.style,{position:'fixed',left:'-20000px',top:'0',width:state.width+'px',height:state.height+'px',visibility:'hidden'});document.body.append(host);let renderer;
    try{renderer=api.render(host,match.chapter);const measured=await renderer.ready;const flow=measured.flow,a=matchBlock(flow,match.first.unit);if(!a)throw Error('Фрагмент недоступен');const point=textPoint(a,a.matches('.book-table-launch')?0:match.first.offset),range=document.createRange();range.setStart(point.node,Math.min(point.offset,Math.max(0,point.node.length-1)));range.setEnd(point.node,Math.min(point.node.length,point.offset+1));const rect=range.getClientRects()[0];if(!rect)throw Error('Не удалось определить страницу');const x=rect.left-flow.getBoundingClientRect().left,page=Math.max(0,Math.min(measured.count-1,Math.floor((x+12)/measured.stride)));if(version!==navVersion)return;await restore({chapter:match.chapter,page});}
    finally{renderer?.destroy();host.remove();}
   }
   if(disposed||version!==navVersion)return;await frame();await frame();if(match.first.unit.cell!==undefined){const launch=root.querySelector(`.reading-content .book-flow [data-block-index="${match.first.unit.block}"].book-table-launch`);if(launch){launch.click();await frame();await frame();const cell=root.querySelectorAll('.book-table-panel td')[match.first.unit.cell],scroll=root.querySelector('.book-table-scroll');if(cell&&scroll)scroll.scrollTop=Math.max(0,cell.offsetTop-scroll.clientHeight/3);root.classList.add('book-search-browsing');}}active=number;paint(match);nav.querySelector('[aria-label="Показать результаты поиска"]')?.focus({preventScroll:true});
  }catch(error){if(!disposed&&version===navVersion){open();status('Не удалось перейти. Попробуй ещё раз.');console.error('Libra search navigation:',error);}}
  finally{navigating=false;updateNav();}
 }
 function onResize(){clearHighlight();if(active>=0&&!panel&&!navigating){const version=navVersion;setTimeout(()=>{if(version===navVersion&&active>=0&&!disposed)paint(matches[active]);},250);}}
 window.addEventListener('resize',onResize);const onReading=event=>{if(event.target.closest?.('.reading-zones'))clearHighlight();};root.addEventListener('touchstart',onReading,{passive:true});root.addEventListener('click',onReading);
 return ()=>{disposed=true;lifetime.abort();clearTimeout(timer);closeAll(false);tool.remove();window.removeEventListener('resize',onResize);root.removeEventListener('touchstart',onReading);root.removeEventListener('click',onReading);delete root.dataset.bookSearchInstalled;};
}

let installedRoot,cleanup;const observe=new MutationObserver(()=>{const root=document.querySelector('.reading-root');if(root===installedRoot)return;cleanup?.();installedRoot=root;cleanup=root?installBookSearch(root):null;});
observe.observe(document.documentElement,{childList:true,subtree:true});
