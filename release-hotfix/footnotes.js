// Footnote reader for the preserved release. Imported files remain in IndexedDB;
// note text is rendered with textContent, never publisher HTML.
(() => {
 const style=document.createElement('style');
 style.textContent=`
 .libra-note-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.13);display:flex;align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top,0px) + 18px) 18px calc(env(safe-area-inset-bottom,0px) + 18px)}
 .libra-note-card{box-sizing:border-box;width:min(100%,460px);max-height:65dvh;overflow:auto;padding:22px;border-radius:24px;border:1px solid color-mix(in srgb,var(--fg,#292925) 14%,transparent);background:color-mix(in srgb,var(--bg,#f6f3ec) 88%,transparent);color:var(--fg,#292925);box-shadow:0 20px 70px #0003;backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);font:16px/1.55 system-ui,sans-serif;animation:libra-note-enter .16s ease-out}
 .libra-note-card header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}.libra-note-card strong{font-size:13px;font-weight:600;opacity:.6}.libra-note-card button{flex:none;min-width:44px;min-height:44px;border:0;border-radius:50%;background:color-mix(in srgb,currentColor 8%,transparent);color:inherit;font-size:24px;cursor:pointer}.libra-note-text{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.libra-note-card button:focus-visible{outline:2px solid currentColor;outline-offset:3px}
 @keyframes libra-note-enter{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.libra-note-card{animation:none}}
 `;
 document.head.append(style);
 let overlay=null,closeActive=null,suppressedUntil=0,touch=null,request=0;
 const root=()=>document.querySelector('.reading-root');
 function show(text){
  closeActive?.();
  const reader=root(),previous=document.activeElement;
  const backdrop=document.createElement('div');backdrop.className='libra-note-backdrop';
  const panel=document.createElement('section');panel.className='libra-note-card';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Сноска');
  const header=document.createElement('header'),title=document.createElement('strong'),button=document.createElement('button'),body=document.createElement('p');
  title.textContent='Сноска';button.type='button';button.setAttribute('aria-label','Закрыть сноску');button.textContent='×';body.className='libra-note-text';body.textContent=text;
  header.append(title,button);panel.append(header,body);backdrop.append(panel);document.body.append(backdrop);overlay=backdrop;
  const inertBefore=reader?.inert; if(reader){reader.inert=true;reader.classList.add('reading-modal-open')}
  const key=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeActive?.()}else if(event.key==='Tab'){event.preventDefault();button.focus()}};
  closeActive=()=>{request++;document.removeEventListener('keydown',key,true);backdrop.remove();overlay=null;closeActive=null;if(reader){reader.inert=inertBefore;reader.classList.remove('reading-modal-open')}if(previous?.isConnected)previous.focus({preventScroll:true})};
  button.onclick=()=>closeActive?.();backdrop.onclick=e=>{if(e.target===backdrop)closeActive?.()};document.addEventListener('keydown',key,true);button.focus({preventScroll:true});
  return body;
 }
 function noteLink(element){
  const link=element?.closest?.('[data-note],a[href]');if(!link)return null;
  if(link.hasAttribute('data-note'))return link;
  const ref=link.getAttribute('href')||'';
  if(!ref.includes('#')||/^(?:[a-z][\w+.-]*:|\/\/)/i.test(ref))return null;
  return link.matches('[epub\\:type~="noteref"],[role="doc-noteref"]')||link.querySelector('sup')||/^\s*[\d*†‡]+\s*$/.test(link.textContent||'')?link:null;
 }
 function contentAt(x,y){
  const reader=root(),zones=reader?.querySelector('.reading-zones'),content=reader?.querySelector('.reading-content');if(!content)return null;
  const a=zones?.style.pointerEvents,b=content.style.pointerEvents;
  try{if(zones)zones.style.pointerEvents='none';content.style.pointerEvents='auto';let hit=document.elementFromPoint(x,y);if(hit?.tagName==='IFRAME'){const rect=hit.getBoundingClientRect();hit=hit.contentDocument?.elementFromPoint(x-rect.left,y-rect.top)}return hit}
  catch{return null}finally{if(zones)zones.style.pointerEvents=a;content.style.pointerEvents=b}
 }
 async function activeFile(){
  const id=root()?.dataset.bookId;if(!id)throw Error('Не удалось определить открытую книгу');
  const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('libra-library');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  try{return await new Promise((resolve,reject)=>{
   const tx=database.transaction('books','readonly'),read=tx.objectStore('books').get(id);
   tx.oncomplete=()=>{const item=read.result;if(!item){reject(Error('Книга не найдена на устройстве'));return}resolve({item,file:item.file instanceof Blob?item.file:new Blob([item.fileBytes],{type:item.fileType})})};tx.onerror=()=>reject(tx.error);
  })}finally{database.close()}
 }
 function targetText(doc,id){
  const node=doc.getElementById(id);if(!node)return null;
  // An empty backlink anchor commonly precedes the actual footnote paragraph.
  return (node.textContent?.trim()?node:node.closest('aside,li,p,section')||node.parentElement)?.textContent?.trim()||null;
 }
 async function resolve(link){
  const ref=link.dataset.note||link.getAttribute('href')||'',id=decodeURIComponent(ref.includes('#')?ref.slice(ref.indexOf('#')+1):ref);
  if(!id)throw Error('В ссылке не указан текст сноски');
  if(!link.hasAttribute('data-note')&&ref.startsWith('#')){
   const same=targetText(link.ownerDocument,id);if(same)return same;
  }
  const {item,file}=await activeFile();
  if(item.format==='fb2'){
   if(file.size>52428800)throw Error('Книга превышает лимит 50 МБ');
   const buffer=new Uint8Array(await file.arrayBuffer()),head=new TextDecoder().decode(buffer.slice(0,512));
   const encoding=buffer[0]===255&&buffer[1]===254?'utf-16le':buffer[0]===254&&buffer[1]===255?'utf-16be':head.match(/encoding\s*=\s*['"]([^'"]+)/i)?.[1]||'utf-8';
   const xml=new TextDecoder(encoding).decode(buffer);
   if(/<!DOCTYPE|<!ENTITY/i.test(xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g,'')))throw Error('DTD в книге не поддерживается');
   const doc=new DOMParser().parseFromString(xml,'application/xml');
   const node=Array.from(doc.getElementsByTagName('*')).find(n=>n.getAttribute('id')===id);
   if(node)return Array.from(node.children).map(n=>n.textContent?.trim()).filter(Boolean).join('\n\n')||node.textContent;
  }else if(item.format==='epub'){
   const {default:ePub}=await import('./assets/src-BLsCKbRG.js');const book=ePub(await file.arrayBuffer());
   try{
    await book.ready;
    const base=link.ownerDocument.querySelector('base')?.getAttribute('href')||'';
    const url=new URL(ref,new URL(base,'https://book.invalid/'));
    const doc=await book.archive.request(url.pathname);const text=targetText(doc,id);if(text)return text;
   }finally{book.destroy()}
  }
  throw Error('Текст сноски отсутствует в файле книги');
 }
 function activate(link){
  const reader=root(),body=show('Открываем сноску…'),token=++request;
  void resolve(link).then(text=>{if(token===request&&root()===reader)body.textContent=text}).catch(error=>{if(token===request)body.textContent=error.message||'Не удалось открыть сноску'});
 }
 function click(event){
  if(overlay)return;
  const link=noteLink(event.target);if(!link)return;
  event.preventDefault();event.stopImmediatePropagation();activate(link);
 }
 document.addEventListener('click',event=>{
  if(Date.now()<suppressedUntil&&event.target?.closest?.('.reading-zones')){event.preventDefault();event.stopImmediatePropagation();return}
  if(event.target?.closest?.('.reading-zones')){const link=noteLink(contentAt(event.clientX,event.clientY));if(link){event.preventDefault();event.stopImmediatePropagation();activate(link);return}}
  click(event);
 },true);
 document.addEventListener('touchstart',event=>{
  touch=null;if(!root()||overlay||event.touches.length!==1)return;
  const point=event.touches[0],link=noteLink(contentAt(point.clientX,point.clientY));
  if(link)touch={link,x:point.clientX,y:point.clientY};
 },{capture:true,passive:true});
 document.addEventListener('touchmove',event=>{if(touch&&(event.touches.length!==1||Math.hypot(event.touches[0].clientX-touch.x,event.touches[0].clientY-touch.y)>10))touch=null},{capture:true,passive:true});
 document.addEventListener('touchcancel',()=>{touch=null},{capture:true,passive:true});
 document.addEventListener('touchend',event=>{
  const start=touch;touch=null;if(!start||!event.changedTouches.length)return;
  const end=event.changedTouches[0];if(Math.hypot(end.clientX-start.x,end.clientY-start.y)>10)return;
  event.preventDefault();event.stopImmediatePropagation();suppressedUntil=Date.now()+900;activate(start.link);
 },{capture:true,passive:false});
 const documents=new WeakSet();
 const observer=new MutationObserver(()=>{
  if(overlay&&!root())closeActive?.();
  for(const frame of document.querySelectorAll('.epub-mount iframe')){
   try{const doc=frame.contentDocument;if(doc&&!documents.has(doc)){documents.add(doc);doc.addEventListener('click',click,true)}}catch{}
  }
 });
 observer.observe(document.body,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>{closeActive?.();touch=null});
})();
