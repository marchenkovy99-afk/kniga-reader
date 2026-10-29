import {paginate} from '../reader/src/pagination.js';
const settings={font:'serif',fontSize:22,lineHeight:1.1,margin:8,paragraphGap:0,indent:1.3,letterSpacing:0,align:'justify',hyphens:true};
const prose='Для конца октября погода стояла на удивление хорошая. Он открыл книгу и начал читать. ';
const results=[],report=document.querySelector('#results');
for(const size of [12,120]){
 const blocks=Array.from({length:size},(_,i)=>{const text=`Абзац ${i}. ${prose.repeat(6)}`;return{type:'p',text,html:text};});
 for(const engine of ['legacy','dom']){
  const runs=[];
  for(let repeat=0;repeat<3;repeat++){
   const start=performance.now();let first=null,maxGap=0;
   const pages=await paginate(blocks,{width:393,height:808,settings,engine,onBatch:(_pages,{complete})=>{if(first===null&&!complete)first=performance.now()-start;}});
   for(const page of pages.slice(0,-1))if(page.breakReason==='capacity')maxGap=Math.max(maxGap,page.geometry.freeSpace);
   runs.push({total:Math.round(performance.now()-start),firstUsable:Math.round(first??performance.now()-start),pages:pages.length,maxGap});
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  results.push({paragraphs:size,sourceCharacters:blocks.reduce((n,b)=>n+b.text.length,0),engine,runs});report.textContent=JSON.stringify(results,null,2);
 }
}
document.title='Complete: engine performance';document.body.dataset.result='pass';
