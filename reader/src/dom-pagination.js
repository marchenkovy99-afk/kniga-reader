import {createDocumentModel,blockBoundaries,assertSourceRanges} from './document-model.js';
import {createPageRenderer} from './page-renderer.js';
import {createTextLayoutEngine,checkCancelled} from './text-layout-engine.js';
import {assertPageIntegrity} from './page-integrity.js';
import {russianHyphenOffsets} from './hyphenation.js';

export const DOM_ENGINE_VERSION=1;
const fail=()=>{throw Error('Этот блок не помещается на странице. Уменьшите размер шрифта или поля. Исходная книга сохранена.');};
function legalBreaks(block,hyphens){
 const breaks=new Map([[block.text.length,false]]),boundaries=new Set(blockBoundaries(block));
 for(const match of block.text.matchAll(/\s+|[\-‐–]/gu)){const end=match.index+match[0].length;if(boundaries.has(end))breaks.set(end,false);}
 if(hyphens&&!['verse','preformatted'].includes(block.presentation.role)&&block.type!=='verse'){
  for(const word of block.text.matchAll(/[А-ЯЁа-яё]+/gu))for(const cut of russianHyphenOffsets(word[0]))if(boundaries.has(word.index+cut))breaks.set(word.index+cut,true);
 }
 return [...breaks].map(([to,hyphen])=>({to,hyphen})).sort((a,b)=>a.to-b.to);
}
function rightmost(values,offset){let low=0,high=values.length;while(low<high){const mid=(low+high)>>>1;if(values[mid]<=offset)low=mid+1;else high=mid;}return low;}

/** Build a validated contiguous source prefix in bounded, cancellable work slices. */
export async function paginateDOM(blocks,{width,height,settings,signal,onProgress,onBatch,model=createDocumentModel(blocks),timeBudget=12}={}){
 checkCancelled(signal);
 const renderer=createPageRenderer(model),layout=createTextLayoutEngine({width,height,settings,renderer});
 const pages=[],breaks=new Map();let parts=[],sliceStart=performance.now(),lastBatch=0,lastBatchAt=sliceStart;
 const prepared=i=>{if(!breaks.has(i))breaks.set(i,legalBreaks(model.blocks[i],settings.hyphens));return breaks.get(i);};
 const part=(block,from,to,hyphen=false)=>({block,from,to,...(hyphen?{hyphen:true}:{})});
 async function yieldWork(){
  checkCancelled(signal);
  if(performance.now()-sliceStart>=timeBudget){await new Promise(resolve=>setTimeout(resolve,0));sliceStart=performance.now();checkCancelled(signal);}
 }
 async function publish(complete=false){
  checkCancelled(signal);
  if(!onBatch||!pages.length||pages.length===lastBatch&&!complete)return;
  if(!complete&&pages.length<3&&performance.now()-lastBatchAt<100)return;
  if(!complete&&lastBatch>0&&pages.length-lastBatch<8&&performance.now()-lastBatchAt<150)return;
  lastBatch=pages.length;lastBatchAt=performance.now();
  await onBatch(pages.slice(),{complete,engineVersion:DOM_ENGINE_VERSION});checkCancelled(signal);
 }
 async function flush(breakReason='capacity',probe=null){
  if(!parts.length)return;
  if(!layout.fits(parts))fail();
  const start={block:parts[0].block,offset:parts[0].from},last=parts.at(-1),end={block:last.block,offset:last.to};
  const page={fragments:parts.map(p=>Object.freeze({...p})),start,end,breakReason,geometry:layout.geometry(),nextProbe:probe,engineVersion:DOM_ENGINE_VERSION};
  const prior=pages.at(-1)?.end;
  const expected=prior&&prior.offset===model.blocks[prior.block].text.length?{block:prior.block+1,offset:0}:prior||{block:0,offset:0};
  assertSourceRanges(model,[page],{complete:false,start:expected});
  page.html=renderer.html(page);assertPageIntegrity(model.blocks,[page],undefined,{complete:false,start:expected,model});
  pages.push(Object.freeze(page));parts=[];layout.place([]);
  await publish();await yieldWork();
 }
 async function maximal(i,from){
  const block=model.blocks[i],boundaries=blockBoundaries(block),first=rightmost(boundaries,from);
  // Exponential probing bounds DOM work by a page, even in a huge paragraph.
  let low=first-1,high=Math.min(boundaries.length-1,first+63),step=64;
  while(layout.fits([...parts,part(i,from,boundaries[high])])){
   low=high;if(high===boundaries.length-1)break;
   step*=2;high=Math.min(boundaries.length-1,high+step);await yieldWork();
  }
  while(low<high){const mid=Math.ceil((low+high)/2);if(layout.fits([...parts,part(i,from,boundaries[mid])]))low=mid;else high=mid-1;await yieldWork();}
  if(low<first)return null;
  const max=boundaries[low];
  if(max===block.text.length)return part(i,from,max);
  const emergency=part(i,from,max);
  layout.fits([...parts,emergency]);const fullBottom=layout.geometry().last;
  const opportunities=prepared(i).filter(b=>b.to>from&&b.to<=max);
  for(let n=opportunities.length-1;n>=0;n--){
   const candidate=part(i,from,opportunities[n].to,opportunities[n].hyphen);
   if(!layout.fits([...parts,candidate]))continue;
   const g=layout.geometry();if(fullBottom-g.last>g.lineHeight*.8)return emergency;
   return candidate;
  }
  return emergency;
 }
 try{
  await layout.ready(signal);
  for(let i=0;i<model.blocks.length;i++){
   const block=model.blocks[i],length=block.text.length;let from=0;
   if(block.type==='h2'&&parts.length)await flush('chapter-start');
   const indivisible=!length||/<(?:table|img)\b/i.test(block.html);
   if(indivisible){
    const whole=part(i,0,length);layout.place([...parts,whole]);await layout.ready(signal);
    if(!layout.fits([...parts,whole])&&parts.length)await flush('indivisible-block');
    if(!layout.fits([...parts,whole]))fail();
    parts.push(whole);await flush('indivisible-block');await yieldWork();continue;
   }
   const next=model.blocks[i+1];
   if((block.type==='h3'||block.presentation.role==='subtitle')&&parts.length&&next?.text.length){
    const prefix=next.text.match(/^\s*\S+\s*/u)?.[0].length||blockBoundaries(next)[1];
    if(!layout.fits([...parts,part(i,0,length),part(i+1,0,prefix)]))await flush('heading-with-next');
   }
   while(from<length){
    checkCancelled(signal);
    const fragment=await maximal(i,from);
    if(!fragment){if(parts.length){await flush('capacity',part(i,from,blockBoundaries(block)[rightmost(blockBoundaries(block),from)]));continue;}fail();}
    let chosen=fragment;
    for(const candidate of prepared(i)){
     if(candidate.to<=chosen.to)continue;
     const extended=part(i,from,candidate.to,candidate.hyphen);
     if(!layout.fits([...parts,extended]))break;
     chosen=extended;await yieldWork();
    }
    parts.push(chosen);from=chosen.to;
    if(from<length){
     const nextBreak=prepared(i).find(b=>b.to>from),probe=nextBreak?part(i,chosen.from,nextBreak.to,nextBreak.hyphen):null;
     if(probe&&layout.fits([...parts.slice(0,-1),probe]))throw Error('Не пройдена проверка плотности страницы. Исходный текст сохранён.');
     await flush('capacity',probe);
    }
    await yieldWork();
   }
   onProgress?.(Math.round((i+1)/model.blocks.length*100));await yieldWork();
  }
  await flush('document-end');assertSourceRanges(model,pages);await publish(true);return pages;
 }finally{layout.destroy();renderer.clear();}
}
