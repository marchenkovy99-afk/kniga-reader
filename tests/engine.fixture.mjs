import {paginate,applyTypography} from '../reader/src/pagination.js';
import {visibleContentFits} from '../reader/src/pagination-geometry.js';
import {createDocumentModel,assertSourceRanges,graphemeBoundaries} from '../reader/src/document-model.js';
import {createPageRenderer} from '../reader/src/page-renderer.js';
import {assertPageIntegrity} from '../reader/src/page-integrity.js';

const results=[],report=document.querySelector('#results'),preview=document.querySelector('#preview');
const check=(condition,message)=>{if(!condition)throw Error(message);};
async function run(name,fn){try{results.push({name,status:'PASS',...await fn()});}catch(e){results.push({name,status:'FAIL',error:e.stack||e.message});}report.textContent=JSON.stringify(results,null,2);}
const settings={font:'serif',fontSize:22,lineHeight:1.1,margin:8,paragraphGap:0,indent:1.3,letterSpacing:0,align:'justify',hyphens:true};
const prose='Для конца октября погода стояла на удивление хорошая. Он открыл книгу и начал читать. ';
function block(text,type='p',presentation={}){return {type,text,html:text,presentation};}
function mounted(page,options){const el=document.createElement('div');el.className='book-text qa-page';el.dataset.engine='dom';el.style.width=options.width+'px';el.style.height=options.height+'px';applyTypography(el,options.settings,options.width);el.innerHTML=page.html;preview.append(el);return el;}
async function inspect(blocks,options){
 const start=performance.now(),pages=await paginate(blocks,options),model=createDocumentModel(blocks),renderer=createPageRenderer(model);
 assertSourceRanges(model,pages);assertPageIntegrity(blocks,pages);
 let text='',checked=0,maxGap=0;
 for(const [i,page] of pages.entries()){
  const el=mounted(page,options);if(!visibleContentFits(el)){
   const box=el.getBoundingClientRect(),walker=document.createTreeWalker(el,4),range=document.createRange(),rects=[];let n;
   while(n=walker.nextNode()){if(!n.data.trim())continue;range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width&&r.height)rects.push({top:r.top-box.top,bottom:r.bottom-box.top,left:r.left-box.left,right:r.right-box.left});}
   throw Error(`page ${i} clips glyphs: ${JSON.stringify({options,scroll:el.scrollHeight,client:el.clientHeight,rects,measured:page.geometry})}`);
  }text+=el.textContent;
  if(i<pages.length-1&&page.breakReason==='capacity'){
   const bottom=()=>{const walker=document.createTreeWalker(el,4),range=document.createRange();let n,last=0;while(n=walker.nextNode()){if(!n.data.trim())continue;range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width&&r.height)last=Math.max(last,r.bottom);}return last;};
   const originalBottom=bottom(),lineHeight=parseFloat(getComputedStyle(el).lineHeight);
   const parts=page.fragments.map(p=>({...p}));let last=parts.at(-1),source=model.blocks[last.block];
   if(last.to===source.text.length){const next=model.blocks[last.block+1];if(!next||['h2','h3'].includes(next.type)||!next.text.length){el.remove();continue;}last={block:last.block+1,from:0,to:0};parts.push(last);source=next;}
   // Filling a few more glyphs on the existing row is not an additional
   // complete row. Extend independently until a new row appears or overflows.
   for(const next of graphemeBoundaries(source.text).filter(n=>n>last.to)){
    last.to=next;last.hyphen=false;el.innerHTML=renderer.html({fragments:parts});
    const fits=visibleContentFits(el);
    if(bottom()>originalBottom+lineHeight*.6){check(!fits,`page ${i} accepts an additional complete row`);checked++;break;}
    if(!fits){checked++;break;}
   }
  }
  maxGap=Math.max(maxGap,page.geometry?.freeSpace||0);el.remove();
 }
 check(text===blocks.map(b=>b.text).join(''),'source mismatch');
 return {pages:pages.length,sourceCharacters:text.length,densityChecks:checked,ms:Math.round(performance.now()-start),maxGap};
}
await run('No Canvas dependency; exact source ranges and paragraph filling',async()=>{
 const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=()=>{throw Error('Canvas used by layout');};
 try{return await inspect(Array.from({length:12},(_,i)=>block(`Абзац ${i}. ${prose.repeat(i%3+1)}`)),{width:393,height:600,settings});}finally{HTMLCanvasElement.prototype.getContext=original;}
});
await run('Unicode graphemes are indivisible across pages',async()=>inspect([block('👨‍👩‍👧‍👦👍🏽🇷🇺е\u0301'.repeat(90))],{width:320,height:260,settings:{...settings,font:'sans',fontSize:48,margin:72,indent:0,hyphens:false,align:'left'}}));
await run('Inline emphasis, superscripts, newlines, poetry, quotes and headings',async()=>{
 const blocks=[block('Первая глава','h2'),{type:'p',text:prose.repeat(15)+'Текст1.',html:'<em>'+prose.repeat(15)+'</em>Текст<sup>1</sup>.'},block('Подзаголовок','h3'),block(prose.repeat(10),'p',{role:'quote'}),block('Первая строка\nВторая строка\nПоследняя строка\n'.repeat(8),'verse'),block(prose.repeat(4),'p',{role:'preformatted'}),block('Конец главы','h2'),block('Последняя строка книги.')];
 return inspect(blocks,{width:393,height:480,settings});
});
await run('Typography boundary matrix',async()=>{
 let pages=0;for(let i=0;i<18;i++){
  const stats=await inspect([block(prose.repeat(8))],{width:[320,393,720][i%3],height:[260,480,600][i%3],settings:{...settings,font:['serif','sans','literary'][i%3],fontSize:[12,32,48][Math.floor(i/3)%3],lineHeight:[1,1.1,2.5][i%3],margin:i%2?72:8,indent:i%2?3:0,letterSpacing:i%2?3:-.5,align:i%2?'justify':'left',hyphens:i%3!==0}});pages+=stats.pages;
 }return {scenarios:18,pages};
});
await run('Progressive pages arrive before completion; abort stops old results',async()=>{
 const blocks=Array.from({length:100},()=>block(prose.repeat(2))),controller=new AbortController();let batches=0,firstAt=0;
 const job=paginate(blocks,{width:393,height:600,settings,signal:controller.signal,onBatch:async(pages,{complete})=>{check(!complete,'No prefix before completion');batches++;firstAt=pages.length;assertSourceRanges(createDocumentModel(blocks),pages,{complete:false});controller.abort();}});
 let aborted=false;try{await job;}catch(e){aborted=e.name==='AbortError';}check(aborted,'Old generation completed after cancellation');return {batches,firstAt};
});
await run('Oversized tables reject explicitly; source survives',async()=>{
 const text='строка'.repeat(60),html='<table>'+Array.from({length:60},()=>'<tr><td>строка</td></tr>').join('')+'</table>';
 let rejected=false;try{await paginate([{type:'table',html,text}],{width:320,height:260,settings:{...settings,fontSize:48}});}catch(e){rejected=/не помещается/i.test(e.message);}check(rejected,'Oversized table accepted');return {safeRejection:true};
});
document.body.dataset.result=results.every(r=>r.status==='PASS')?'pass':'fail';document.title=`${document.body.dataset.result}: DOM engine`;
