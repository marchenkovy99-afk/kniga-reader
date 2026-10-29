import {importBook} from '../reader/src/importer.js';
import * as storage from '../reader/src/storage.js';
import {accountPreferenceKey} from '../reader/src/account-state.js';

const report=document.querySelector('#results'),frame=document.querySelector('#reader-frame');
const results=[];
const check=(value,message)=>{if(!value)throw Error(message);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,16));
const paintTick=()=>new Promise(resolve=>frame.contentWindow.requestAnimationFrame(resolve));
async function until(fn,label){const start=performance.now();while(!fn()){const error=frame.contentDocument?.querySelector('#page-loading.layout-error');if(error&&!error.hidden)throw Error(label+': '+error.textContent+' '+JSON.stringify(geometry()));if(performance.now()-start>45000)throw Error('Timeout: '+label);await tick();}}
function publish(){report.textContent=JSON.stringify(results,null,2);}
const settings={font:'sans',fontSize:22,lineHeight:1.1,margin:8,paragraphGap:0,paragraphSpacingVersion:1,indent:1.3,letterSpacing:0,align:'justify',hyphens:true,theme:'paper'};
const prose='Утром он открыл книгу и продолжил чтение. Каждая строка должна оставаться видимой полностью. В конце страницы текст не исчезает, а продолжается на следующей. ';
const source='<?xml version="1.0"?><FictionBook><body><section>'+Array.from({length:7},(_,i)=>`<p>Абзац ${i+1}. ${prose.repeat(3)}</p>`).join('')+'</section></body></FictionBook>';
const bytes=new TextEncoder().encode(source),book=await importBook(bytes,'visibility.fb2');
const id='rendered-visibility-test';
await storage.putBook({...book,id,original:bytes.buffer,fileName:'visibility.fb2',addedAt:Date.now(),marks:[],localStateOwner:null,cloudOwner:null});
await storage.setPreference('cloud-owner',null);
await storage.setPreference(accountPreferenceKey(null,'settings'),settings);
await storage.setPreference(accountPreferenceKey(null,'settings-updatedAt'),Date.now());
await storage.deletePreference(accountPreferenceKey(null,'position:'+id));
await storage.deletePreference('pagination-cache:'+id);
frame.src='/kniga-reader/?rendered-visibility-test';
await until(()=>frame.contentDocument?.querySelector(`[data-book="${id}"]`),'library');
const doc=()=>frame.contentDocument;
doc().querySelector(`[data-book="${id}"]`).click();
function active(){return doc().querySelector('.book-page[aria-hidden="false"] .book-text');}
function pending(){const loader=doc().querySelector('#page-loading');return Boolean(loader&&!loader.hidden);}
async function stable(){await until(()=>active()&&!pending()&&doc().querySelector('#book-stage').dataset.layoutState==='ready'&&doc().querySelector('#book-stage').dataset.paginationComplete==='true'&&Math.abs(doc().querySelector('.reader').clientHeight-frame.clientHeight)<1&&Math.abs(active().getBoundingClientRect().height-doc().querySelector('#book-stage').clientHeight)<1,'reading layout');await tick();}
await stable();
function geometry(){
 const text=active();if(!text)return {hidden:true};
 const win=frame.contentWindow,style=win.getComputedStyle(text),page=text.closest('.book-page');
 const hidden=style.visibility==='hidden'||win.getComputedStyle(page).visibility==='hidden'||win.getComputedStyle(doc().querySelector('#flipbook')).visibility==='hidden';
 const stage=doc().querySelector('#book-stage'),b=stage.getBoundingClientRect(),t=text.getBoundingClientRect(),r=doc().querySelector('.reader').getBoundingClientRect();
 let min=Infinity,max=-Infinity,clipped=0,nodes=0;
 const walker=doc().createTreeWalker(text,4),range=doc().createRange();let node;
 while(node=walker.nextNode()){
  if(!node.data.trim())continue;nodes++;range.selectNodeContents(node);
  for(const rect of range.getClientRects()){
   if(rect.width<=0||rect.height<=0)continue;min=Math.min(min,rect.top);max=Math.max(max,rect.bottom);
   if(rect.left<b.left-.02||rect.right>b.right+.02||rect.top<b.top-.02||rect.bottom>b.bottom+.02||rect.top<0||rect.bottom>win.innerHeight+.02)clipped++;
  }
 }
 return {hidden,scrollHeight:text.scrollHeight,scrollWidth:text.scrollWidth,width:text.clientWidth,clipped,nodes,first:min,last:max,top:b.top,bottom:b.bottom,viewport:win.innerHeight,textHeight:t.height,stageHeight:stage.clientHeight,readerHeight:r.height,position:doc().querySelector('#reader-page-position').textContent,font:style.fontSize};
}
async function scenario(name,fn){try{const details=await fn();results.push({name,status:'PASS',...details});}catch(e){results.push({name,status:'FAIL',error:e.message});}publish();}
await scenario('Every rendered page preserves all source text inside the real reading viewport',async()=>{
 const pages=[],fragments=[];let last=-1;
 const progress=doc().querySelector('#reading-progress');const count=Number(progress.max)+1;
 for(let i=0;i<count;i++){
  progress.value=String(i);progress.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));
  await until(()=>active()?.dataset.page===String(i)&&!geometry().hidden,'page '+i);await stable();
  const g=geometry();check(!g.hidden&&g.clipped===0,JSON.stringify(g));
  for(const p of active().querySelectorAll('[data-block]'))fragments.push({block:Number(p.dataset.block),from:Number(p.dataset.from),to:Number(p.dataset.to),text:p.textContent});
  pages.push(g);last=i;
 }
 check(fragments.map(p=>p.text).join('')===book.blocks.map(b=>b.text).join(''),'Rendered page text differs from imported book');
 let block=0,offset=0;for(const p of fragments){check(p.block===block&&p.from===offset,'Page boundary skips or repeats source characters');offset=p.to;if(offset===book.blocks[block].text.length){block++;offset=0;}}
 check(block===book.blocks.length&&offset===0,'Final source characters missing');
 return {pages:pages.length,sourceCharacters:book.chars,clippedRectangles:0,first:pages[0],last:pages[last]};
});
await scenario('Shrinking the viewport never displays old text outside the new page',async()=>{
 frame.style.height='470px';
 const observations=[];
 for(let i=0;i<22;i++){await paintTick();const g=geometry();if(!g.hidden)observations.push(g);}
 await stable();const g=geometry();observations.push(g);
 const bad=observations.filter(g=>g.clipped>0);check(!bad.length,JSON.stringify({clippedFrames:bad.length,first:bad[0]}));
 return {paintedFrames:observations.length,clippedRectangles:0,final:g};
});
await scenario('Opening and closing reading controls never clips a source line',async()=>{
 frame.style.height='852px';await stable();
 const reader=doc().querySelector('.reader'),observations=[];
 for(let cycle=0;cycle<2;cycle++){
  reader.classList.toggle('chrome-hidden');
  for(let i=0;i<18;i++){await paintTick();const g=geometry();if(!g.hidden)observations.push(g);}
  await stable();observations.push(geometry());
 }
 const bad=observations.filter(g=>g.clipped>0);check(!bad.length,JSON.stringify({clippedFrames:bad.length,first:bad[0]}));
 return {paintedFrames:observations.length,clippedRectangles:0};
});
await scenario('Font change and reload retain source position and visible lines',async()=>{
 doc().querySelector('.reader').classList.remove('chrome-hidden');await stable();
 doc().querySelector('#appearance').click();await until(()=>doc().querySelector('#font-select'),'appearance');
 const select=doc().querySelector('#font-select');select.value='serif';select.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));
 await until(()=>active()?.dataset.font==='serif'&&!pending(),'changed font');
 doc().querySelector('#close-sheet').click();await stable();
 const first=geometry();check(first.clipped===0,JSON.stringify(first));
 const before=await storage.getPreference(accountPreferenceKey(null,'position:'+id));
 frame.contentWindow.location.reload();await until(()=>doc().querySelector(`[data-book="${id}"]`),'reloaded library');doc().querySelector(`[data-book="${id}"]`).click();await stable();
 const second=geometry();check(second.clipped===0,JSON.stringify(second));
 check(active().dataset.font==='serif','Saved font was not restored');
 const after=await storage.getPreference(accountPreferenceKey(null,'position:'+id));
 check(JSON.stringify(before?.anchor)===JSON.stringify(after?.anchor),'Reload changed the precise source anchor');
 return {before:before?.anchor,afterAnchor:after?.anchor,after:second,restoredFont:active().dataset.font};
});
await scenario('Landscape and return to portrait preserve every rendered source character',async()=>{
 const observations=[];
 for(const [width,height] of [[720,393],[320,700],[430,932],[393,852],[320,852],[393,852]]){
  frame.style.width=width+'px';frame.style.height=height+'px';
  for(let i=0;i<8;i++){await paintTick();const g=geometry();if(!g.hidden)observations.push(g);}
  await stable();const g=geometry();check(g.clipped===0,JSON.stringify(g));
  const progress=doc().querySelector('#reading-progress'),count=Number(progress.max)+1;let text='';
  for(let i=0;i<count;i++){
   progress.value=String(i);progress.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));
   await until(()=>active()?.dataset.page===String(i)&&!geometry().hidden,'orientation page');await stable();
   const page=geometry();check(page.clipped===0,JSON.stringify(page));text+=active().textContent;
  }
  check(text===book.blocks.map(b=>b.text).join(''),'Orientation changes lost source characters');
 }
 const bad=observations.filter(g=>g.clipped>0);check(!bad.length,JSON.stringify({first:bad[0],clippedFrames:bad.length}));
 return {viewports:6,clippedRectangles:0,sourceCharacters:book.chars};
});
await scenario('Large text is fully readable, then returns to the saved size',async()=>{
 doc().querySelector('.reader').classList.remove('chrome-hidden');await stable();doc().querySelector('#appearance').click();
 await until(()=>doc().querySelector('#number-fontSize'),'size settings');
 const input=doc().querySelector('#number-fontSize');input.value='48';input.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
 await until(()=>active()&&frame.contentWindow.getComputedStyle(active()).fontSize==='48px'&&!pending(),'large type');await stable();
 doc().querySelector('#close-sheet').click();await stable();
 const large=geometry();check(large.clipped===0,JSON.stringify(large));
 doc().querySelector('#appearance').click();await until(()=>doc().querySelector('#number-fontSize'),'restore size settings');
 const restore=doc().querySelector('#number-fontSize');restore.value='22';restore.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
 await until(()=>active()&&frame.contentWindow.getComputedStyle(active()).fontSize==='22px'&&!pending(),'restored type');await stable();
 doc().querySelector('#close-sheet').click();await stable();const restored=geometry();check(restored.clipped===0,JSON.stringify(restored));
 return {large,restored};
});
await scenario('A search jump requested during repagination reaches and saves its precise source position',async()=>{
 doc().querySelector('.reader').classList.remove('chrome-hidden');await stable();
 const progress=doc().querySelector('#reading-progress');progress.value='0';progress.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));
 await until(()=>active()?.dataset.page==='0'&&!geometry().hidden,'first page before search');
 doc().querySelector('#search-book').click();await until(()=>doc().querySelector('#book-search'),'search');
 const input=doc().querySelector('#book-search');input.value='Абзац 6.';input.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
 await until(()=>doc().querySelector('[data-result="0"]'),'search result');
 frame.style.height='600px';await until(()=>doc().querySelector('#book-stage')?.dataset.layoutState==='pending','pending layout');
 doc().querySelector('[data-result="0"]').click();await stable();
 check(geometry().clipped===0,'Search jump clipped text');
 const target=active().querySelector('[data-block="5"]');check(target&&Number(target.dataset.from)===0,'Search target is not on the displayed page');
 let saved;for(let i=0;i<100;i++){saved=await storage.getPreference(accountPreferenceKey(null,'position:'+id));if(saved?.anchor?.block===5&&saved?.anchor?.offset===0)break;await new Promise(resolve=>setTimeout(resolve,20));}
 check(saved?.anchor?.block===5&&saved?.anchor?.offset===0,'Search target was not persisted');
 return {anchor:saved.anchor,clippedRectangles:0};
});
await scenario('Closing a partially prepared long book cancels cleanly',async()=>{
 const longSource='<?xml version="1.0"?><FictionBook><body><section>'+Array.from({length:140},()=>`<p>${prose.repeat(5)}</p>`).join('')+'</section></body></FictionBook>';
 const longBytes=new TextEncoder().encode(longSource),longBook=await importBook(longBytes,'cancel.fb2'),longId='cancel-stream-test';
 await storage.putBook({...longBook,id:longId,original:longBytes.buffer,fileName:'cancel.fb2',addedAt:Date.now(),marks:[],localStateOwner:null,cloudOwner:null});
 await storage.deletePreference('pagination-cache:'+longId);
 frame.contentWindow.location.reload();await until(()=>doc().querySelector(`[data-book="${longId}"]`),'long book library');
 const errors=[];frame.contentWindow.addEventListener('error',e=>errors.push(e.message));frame.contentWindow.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 doc().querySelector(`[data-book="${longId}"]`).click();
 await until(()=>doc().querySelector('#book-stage')?.dataset.layoutState==='ready'&&doc().querySelector('#book-stage')?.dataset.paginationComplete==='false','first usable prefix');
 doc().querySelector('#to-library').click();await until(()=>doc().querySelector(`[data-book="${longId}"]`),'return from streaming');
 await new Promise(resolve=>setTimeout(resolve,200));
 check(errors.length===0,errors.join('; '));check(!doc().querySelector('#book-stage'),'Stale work reopened a closed book');
 return {cancelledWithoutErrors:true,sourceCharacters:longBook.chars};
});
document.body.dataset.result=results.every(r=>r.status==='PASS')?'pass':'fail';
document.title=document.body.dataset.result.toUpperCase()+' — rendered reader';
