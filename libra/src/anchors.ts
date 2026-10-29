/**
 * A reading anchor identifies a UTF-16 code-unit in a block, independently of
 * viewport width, font metrics and current page number.
 *
 * This module reads native CSS multicolumn fragmentation. It NEVER creates,
 * removes, clones or hides source characters. The browser remains responsible
 * for text shaping, line breaking, orphan/widow handling and page fragments.
 */
export type FB2Anchor={block:number;textNode:number;offset:number}; // textNode === -1: non-text block such as a full-page image
type Unit={node:Text;block:number;textNode:number;length:number};
export type PageGeometry={width:number;gap:number};

export function collectTextUnits(flow:Element):Unit[]{
 const units:Unit[]=[];
 for(const block of Array.from(flow.querySelectorAll<HTMLElement>('[data-block-index]'))){
  const index=Number(block.dataset.blockIndex);
  if(!Number.isSafeInteger(index)||index<0)continue;
  const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
  let node:Node|null,number=0;
  while((node=walker.nextNode())){
   const text=node as Text;
   // Only non-empty nodes yield meaningful text layout rectangles.
   if(text.length>0)units.push({node:text,block:index,textNode:number,length:text.length});
   number++;
  }
 }
 return units;
}

function positionPage(flow:Element,node:Text,index:number,geo:PageGeometry):number|null{
 if(!node.length||geo.width<=0)return null;
 const range=document.createRange();
 const start=Math.min(node.length-1,Math.max(0,Math.trunc(index)));
 range.setStart(node,start);range.setEnd(node,start+1);
 const rectangles=range.getClientRects();
 const rect=rectangles.item(0);
 if(!rect||!Number.isFinite(rect.left))return null;
 const flowLeft=flow.getBoundingClientRect().left;
 return Math.max(0,Math.floor((rect.left-flowLeft+0.5)/(geo.width+geo.gap)));
}

/** Anchor an image-only page by its structural block when no text is present. */
function getNonTextAnchor(flow:Element,page:number,geo:PageGeometry):FB2Anchor|null{
 const left=flow.getBoundingClientRect().left;
 for(const block of Array.from(flow.querySelectorAll<HTMLElement>('figure[data-block-index]'))){
  if(!block.querySelector('img'))continue;
  const rect=block.getBoundingClientRect();
  if(!rect.width||!rect.height)continue;
  const column=Math.max(0,Math.floor((rect.left-left+1)/(geo.width+geo.gap)));
  if(column===page)return {block:Number(block.dataset.blockIndex),textNode:-1,offset:0};
 }
 return null;
}
/** First visible character on the page, otherwise the image-only block. */
export function getPageAnchor(flow:Element,page:number,geo:PageGeometry):FB2Anchor|null{
 const units=collectTextUnits(flow);
 if(!units.length)return getNonTextAnchor(flow,Math.max(0,Math.trunc(page)),geo);
 const desired=Math.max(0,Math.trunc(page));
 const lastPage=(unit:Unit)=>positionPage(flow,unit.node,unit.length-1,geo);
 // All characters in source order have nondecreasing CSS column indices.
 // Find the first text node whose last character reaches the target page.
 let lo=0,hi=units.length;
 while(lo<hi){
  const mid=(lo+hi)>>1,p=lastPage(units[mid]);
  if(p===null||p<desired)lo=mid+1;else hi=mid;
 }
 if(lo===units.length)return getNonTextAnchor(flow,desired,geo);
 const unit=units[lo];
 let start=0,end=unit.length;
 while(start<end){
  const mid=(start+end)>>1;
  const p=positionPage(flow,unit.node,mid,geo);
  if(p===null||p<desired)start=mid+1;else end=mid;
 }
 if(start>=unit.length)return getNonTextAnchor(flow,desired,geo);
 const location=positionPage(flow,unit.node,start,geo);
 return location===desired?{block:unit.block,textNode:unit.textNode,offset:start}:getNonTextAnchor(flow,desired,geo);
}

/** Resolve a stored content anchor after layout changes. */
export function getAnchorPage(flow:Element,anchor:FB2Anchor,geo:PageGeometry):number|null{
 const block=Array.from(flow.querySelectorAll<HTMLElement>('[data-block-index]')).find(
  element=>Number(element.dataset.blockIndex)===anchor.block);
 if(!block)return null;
 if(anchor.textNode===-1){
  const rect=block.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  return Math.max(0,Math.floor((rect.left-flow.getBoundingClientRect().left+1)/(geo.width+geo.gap)));
 }
 const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
 const nodes:Text[]=[];let node:Node|null;
 while((node=walker.nextNode()))nodes.push(node as Text);
 const selected=nodes[anchor.textNode];
 if(!selected||!selected.length)return null;
 return positionPage(flow,selected,anchor.offset,geo);
}
