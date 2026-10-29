import {sha256} from 'js-sha256';

const segmenter=new Intl.Segmenter('ru',{granularity:'grapheme'});
export function graphemeBoundaries(text){
 const boundaries=[];for(const part of segmenter.segment(text))boundaries.push(part.index);
 boundaries.push(text.length);return boundaries;
}
const indexes=new WeakMap();
export async function prepareBlockBoundaries(block,{signal,yieldWork}={}){
 if(indexes.has(block))return indexes.get(block);
 const offsets=[];let count=0;
 for(const part of segmenter.segment(block.text)){
  offsets.push(part.index);
  if(++count%1024===0){await yieldWork?.();if(signal?.aborted)throw new DOMException('Cancelled','AbortError');}
 }
 offsets.push(block.text.length);indexes.set(block,offsets);return offsets;
}
export function hasBoundary(block,offset){
 const values=blockBoundaries(block);let low=0,high=values.length-1;
 while(low<high){const mid=(low+high)>>>1;if(values[mid]<offset)low=mid+1;else high=mid;}
 return values[low]===offset;
}
export function blockBoundaries(block){
 if(!indexes.has(block))indexes.set(block,graphemeBoundaries(block.text));
 return indexes.get(block);
}
export function createDocumentModel(source,{id=''}={}){
 if(!Array.isArray(source)||!source.length)throw Error('В книге нет содержимого для чтения.');
 let position=0,chapterId=null;const ids=new Set(),hash=sha256.create();
 const blocks=source.map((block,index)=>{
  if(typeof block.text!=='string'||typeof block.html!=='string')throw Error('Повреждена структура книги. Исходный файл сохранён.');
  let blockId=String(block.id||`b${index}`);if(ids.has(blockId))blockId=`${blockId}:${index}`;ids.add(blockId);
  if(block.type==='h2'||chapterId===null)chapterId=blockId;
  const result=Object.freeze({...block,id:blockId,index,chapterId,start:position,end:position+block.text.length,presentation:Object.freeze({...block.presentation})});
  position=result.end;hash.update(JSON.stringify([result.id,result.type,result.text,result.html,result.presentation]));return result;
 });
 return Object.freeze({id,version:hash.hex(),blocks:Object.freeze(blocks),length:position});
}
function integrityError(){throw Error('Нарушена целостность диапазонов книги или граница графемы. Исходный файл сохранён.');}
/** Validate source-backed pages, or a contiguous prefix during background work. */
export function assertSourceRanges(model,pages,{complete=true,start={block:0,offset:0}}={}){
 let block=start.block,offset=start.offset;
 if(!Array.isArray(pages)||!pages.length)integrityError();
 for(const page of pages){
  const fragments=page.fragments;if(!fragments?.length)integrityError();
  const first=fragments[0],last=fragments.at(-1);
  if(page.start?.block!==first.block||page.start?.offset!==first.from||page.end?.block!==last.block||page.end?.offset!==last.to)integrityError();
  for(const fragment of fragments){
   const source=model.blocks[block];
   if(!source||fragment.block!==block||fragment.from!==offset||!Number.isInteger(fragment.to)||fragment.to<offset||fragment.to>source.text.length||(source.text.length&&fragment.to===offset))integrityError();
   if(!hasBoundary(source,offset)||!hasBoundary(source,fragment.to))integrityError();
   offset=fragment.to;if(offset===source.text.length){block++;offset=0;}
  }
 }
 if(complete&&(block!==model.blocks.length||offset!==0))integrityError();
 return {block,offset};
}
/** Keep legacy UTF-16 block/offset positions; snap corrupt mid-grapheme anchors back. */
export function migrateAnchor(model,anchor={}){
 const found=anchor.blockId==null?-1:model.blocks.findIndex(b=>b.id===anchor.blockId);
 const block=Math.max(0,Math.min(model.blocks.length-1,found>=0?found:Number.isInteger(anchor.block)?anchor.block:0));
 const at=Math.max(0,Math.min(model.blocks[block].text.length,Number.isInteger(anchor.offset)?anchor.offset:0));
 const boundaries=blockBoundaries(model.blocks[block]);let low=0,high=boundaries.length-1;
 while(low<high){const mid=Math.ceil((low+high)/2);if(boundaries[mid]<=at)low=mid;else high=mid-1;}
 return {block,offset:boundaries[low]};
}
