const frame=document.querySelector('#app'),out=document.querySelector('#result');
frame.style.width=(Number(new URLSearchParams(location.search).get('width'))||390)+'px';
const results=[],assert=(ok,message)=>{results.push({pass:!!ok,message});out.textContent=JSON.stringify({status:'RUNNING',results},null,2);if(!ok)throw Error(message)},pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=15000){const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error('timeout: '+String(fn));await pause(25)}return fn()}
const tick=()=>new Promise(r=>frame.contentWindow.requestAnimationFrame(r));
const paragraphs=Array.from({length:32},(_,i)=>`<p>Абзац ${i}. ${'Текст книги сохраняется при плавном перелистывании страниц. '.repeat(7)}</p>`).join('');
const run=Date.now();
const fb2=`<?xml version="1.0"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Fluid FB2 ${run}</book-title><author><first-name>Test</first-name></author></title-info></description><body><section><title><p>Первая глава</p></title>${paragraphs}</section><section><title><p>Вторая глава</p></title>${paragraphs}</section></body></FictionBook>`;
let w,d,r,reads=0,clones=0,record=false,mutations=0,stacks=[];
function touch(type,x,y=350){const e=new w.Event(type,{bubbles:true,cancelable:true});const p={clientX:x,clientY:y};Object.defineProperties(e,{touches:{value:type==='touchend'||type==='touchcancel'?[]:[p]},changedTouches:{value:[p]}});r.querySelector('.reading-zones').dispatchEvent(e)}
const pos=()=>{const v=r.querySelector('.reading-content .page-viewport');return v?.libraFb2Preview?.state()||r.querySelector('.reading-content .epub-mount')?.libraEpubPreview?.state().rendition.currentLocation()};
const active=()=>r.querySelector('[data-libra-page-turn][data-active]');
const ready=()=>r.querySelector('[data-libra-page-turn]:not([data-active]) [data-libra-turn-sheet=incoming]');
async function settle(){await until(()=>!active());await until(ready);await pause(80)}
async function importBook(name,type,data){
 const existing=new Set([...d.querySelectorAll('[data-library-book]')].map(el=>el.dataset.libraryBook));
 const input=d.querySelector('input[type=file]'),dt=new w.DataTransfer();dt.items.add(new w.File([data],name,{type}));input.files=dt.files;input.dispatchEvent(new w.Event('change',{bubbles:true}));
 const added=()=>[...d.querySelectorAll('[data-library-book]')].find(el=>!existing.has(el.dataset.libraryBook));
 await until(added);added().querySelector('.book-tile-open').click();
 await until(()=>d.querySelector('.reading-root'));r=d.querySelector('.reading-root');await until(ready);await until(()=>!r.querySelector('.reading-content .book-flow.no-animation'));await pause(350);
}
async function swipe(dx=-145){touch('touchstart',280);for(let i=1;i<=12;i++){touch('touchmove',280+dx*i/12);await tick()}touch('touchend',280+dx);await settle()}
async function testReader(format){
 const before=JSON.stringify(pos());touch('touchstart',280);for(let i=1;i<=12;i++){touch('touchmove',280-i*12);await tick()}
 assert(!!active(),format+': interactive overlay exists before release');
 assert(JSON.stringify(pos())===before,format+': no live pagination/progress change while dragging '+before+' => '+JSON.stringify(pos()));
 const track=active().querySelector('[data-libra-turn-track]');await until(()=>Math.abs(parseFloat(track.style.transform.slice(12))+144)<1,4000);assert(true,format+': exact finger tracking');
 const sheetCount=active().querySelectorAll('[data-libra-turn-sheet]').length;assert(sheetCount>=2&&sheetCount<=3,format+': bounded prepared planes');
 touch('touchend',136);await settle();assert(JSON.stringify(pos())!==before,format+': committed once');
 const after=JSON.stringify(pos());await swipe(145);assert(JSON.stringify(pos())===before,format+': backward restores exact page');
 touch('touchstart',280);touch('touchmove',240);await tick();touch('touchcancel',240);await settle();assert(JSON.stringify(pos())===before,format+': cancellation preserves position');
 touch('touchstart',380);touch('touchend',380);await settle();assert(JSON.stringify(pos())===after,format+': edge tap instant destination matches swipe');
 // Instrument only the frame loop; touch-start hit-testing is owned by the selection/footnote module.
 reads=0;clones=0;touch('touchstart',280);touch('touchmove',260);await tick();record=true;
 for(let i=1;i<=8;i++){touch('touchmove',260-i*3);await tick()}record=false;assert(reads===0,format+': zero geometry reads during 8 drag frames ('+reads+') '+JSON.stringify(stacks));assert(clones===0,format+': zero DOM clones during drag');touch('touchend',170);await settle();
 for(let i=0;i<2;i++)await swipe(-145);
 assert(!d.querySelector('.clipping-alert'),format+': no clipping alert');
 const physical=()=>{const view=r.querySelector('.reading-content .page-viewport');if(view)return view.libraFb2Preview.state();const api=r.querySelector('.reading-content .epub-mount').libraEpubPreview;return api.physical(api.state().rendition.currentLocation());};
 const mark=r.querySelector('[aria-label="Закладка"]');mark?.click();await until(()=>mark?.getAttribute('aria-pressed')==='true');assert(true,format+': bookmark saved');
 const quote=[...r.querySelectorAll('.reading-tools button')].find(x=>x.textContent.trim()==='Цитата');quote.click();await until(()=>r.classList.contains('reading-quote-mode'));const quoted=JSON.stringify(pos());touch('touchstart',280);touch('touchmove',120);touch('touchend',120);assert(JSON.stringify(pos())===quoted,format+': selection mode preserves position');r.querySelector('.quote-mode-tip button').click();await until(()=>!r.classList.contains('reading-quote-mode'));await until(ready);
 let p=physical();for(let i=0;i<80&&(p.chapter===undefined?p.page<p.total:p.page<p.pages-1);i++){touch('touchstart',380);touch('touchend',380);await settle();p=physical();}
 const last=physical();await pause(300);await swipe(-145);const next=physical();assert(format==='FB2'?next.chapter===last.chapter+1&&next.page===0:next.index>last.index&&next.page===1,format+': next chapter starts at its first page');
 await swipe(145);const previous=physical();assert(format==='FB2'?previous.chapter===last.chapter&&previous.page===last.page:previous.index===last.index&&previous.page===last.page,format+': previous chapter restores its final page');
 const readingBefore=r.dataset.bookId;const savedAtExit=await new Promise((resolve,reject)=>{const open=indexedDB.open('libra-library');open.onsuccess=()=>{const db=open.result,tx=db.transaction('reading'),req=tx.objectStore('reading').get(readingBefore);req.onsuccess=()=>{resolve(req.result?.position);db.close()};req.onerror=()=>reject(req.error)};open.onerror=()=>reject(open.error)});results.push({format,savedAtExit,physicalAtExit:previous});r.querySelector('[aria-label="В библиотеку"]').click();await until(()=>!d.querySelector('.reading-root'));await pause(100);d.querySelector(`[data-library-book="${readingBefore}"] .book-tile-open`).click();await until(()=>d.querySelector('.reading-root'));r=d.querySelector('.reading-root');await until(ready);assert(JSON.stringify(physical())===JSON.stringify(previous),format+': reopening restores the exact reading position '+JSON.stringify(previous)+' => '+JSON.stringify(physical()));

 r.querySelector('[aria-label="В библиотеку"]').click();await until(()=>!d.querySelector('.reading-root'));
 results.push({format,performance:JSON.parse(JSON.stringify(w.libraPageTurnMetrics))});
}
try{
 // This disposable localhost origin contains only QA fixture data.
 await new Promise((resolve,reject)=>{const q=indexedDB.deleteDatabase('libra-library');q.onsuccess=resolve;q.onerror=()=>reject(q.error);});
 localStorage.clear();frame.src='./?libraPerf';
 await until(()=>frame.contentDocument?.querySelector('input[type=file]'));w=frame.contentWindow;d=frame.contentDocument;
 // QA runs in this isolated origin only. Test books never touch production user data.
 const bounds=w.Element.prototype.getBoundingClientRect,clone=w.Node.prototype.cloneNode,computed=w.getComputedStyle;
 w.Element.prototype.getBoundingClientRect=function(...args){if(record){reads++;if(stacks.length<8)stacks.push(new Error().stack)}return bounds.apply(this,args)};
 w.Node.prototype.cloneNode=function(...args){if(record)clones++;return clone.apply(this,args)};
 w.getComputedStyle=function(...args){if(record){reads++;if(stacks.length<8)stacks.push(new Error().stack)}return computed.apply(this,args)};
 const observer=new w.PerformanceObserver(list=>results.push({longTasks:list.getEntries().map(e=>e.duration)}));try{observer.observe({type:'longtask',buffered:true})}catch{}
 await importBook('fb2-fixture.fb2','application/xml',fb2);await testReader('FB2');
 const epub=await (await fetch('./fixture.epub')).arrayBuffer();await importBook('epub-fixture.epub','application/epub+zip',epub);await testReader('EPUB');
 out.textContent=JSON.stringify({status:'PASS',results},null,2);document.title='PASS: Libra release QA';
}catch(error){out.textContent=JSON.stringify({status:'FAIL',error:String(error),stack:error.stack,results},null,2);document.title='FAIL: Libra release QA'}
