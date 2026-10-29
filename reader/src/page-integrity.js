import {createDocumentModel,assertSourceRanges} from './document-model.js';
function readDOM(html){
 const root=document.createElement('div');root.innerHTML=html;
 return [...root.querySelectorAll('[data-block]')].map(n=>({block:Number(n.dataset.block),from:Number(n.dataset.from),to:Number(n.dataset.to),text:n.textContent}));
}
/** Verify rendered page text, not just page boundary metadata. */
export function assertPageIntegrity(blocks,pages,readFragments=readDOM,{complete=true,start={block:0,offset:0},model}={}){
 const fail=()=>{throw Error('Нарушена целостность страниц. Текст не будет показан с пропусками. Исходный файл сохранён.');};
 if(!blocks.length||!Array.isArray(pages)||!pages.length)fail();
 let block=start.block,offset=start.offset;
 if(pages.some(page=>page.fragments))assertSourceRanges(model||createDocumentModel(blocks),pages,{complete,start});
 for(const page of pages){
  const fragments=readFragments(page.html);if(!fragments.length)fail();
  const first=fragments[0],last=fragments.at(-1);
  if(page.start?.block!==first.block||page.start?.offset!==first.from||page.end?.block!==last.block||page.end?.offset!==last.to)fail();
  for(const fragment of fragments){
   // Empty image/spacing blocks still have a fragment and must occur in order.
   if(fragment.block!==block||fragment.from!==offset||!Number.isInteger(fragment.to)||fragment.to<offset||fragment.to>blocks[block]?.text.length)fail();
   if(fragment.text!==blocks[block].text.slice(offset,fragment.to))fail();
   offset=fragment.to;
   if(offset===blocks[block].text.length){block++;offset=0;}
  }
 }
 if(complete&&(block!==blocks.length||offset!==0))fail();
}
