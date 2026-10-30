/**
 * A content anchor points to a UTF-16 code unit in the original FB2 block.
 * Source characters remain in the DOM; native CSS columns own fragmentation.
 *
 * Large books may contain thousands of blocks. Collect text nodes ONCE per
 * rendered chapter, rather than traversing the entire chapter on every tap.
 */
export type FB2Anchor={block:number;textNode:number;offset:number};
type Unit={node:Text;block:number;textNode:number;length:number};
export type PageGeometry={width:number;gap:number;stride?:number};
/**
 * In Safari fractional column origins may be reported a fraction of a pixel
 * BEFORE the expected stride. Pixels in the inter-column gap belong to the
 * following column, not the preceding page. This correction is important
 * both for restoring anchors and for swiping between pages after a reflow.
 */
export function columnAtOffset(offset:number,geo:PageGeometry):number{
 const stride=geo.stride||geo.width+geo.gap;
 if(stride<=0||!Number.isFinite(offset))return 0;
 const x=Math.max(0,offset);
 const page=Math.floor(x/stride);
 const inPage=x-page*stride;
 return page+(inPage>geo.width+geo.gap*.35?1:0);
}

type AnchorIndex={
 first:Element|null;last:Element|null;count:number;
 units:Unit[];blocks:Map<number,HTMLElement>;nonText:HTMLElement[];
};
const indexes=new WeakMap<Element,AnchorIndex>();

function indexFor(flow:Element):AnchorIndex{
 const first=flow.firstElementChild,last=flow.lastElementChild,count=flow.childElementCount;
 const cached=indexes.get(flow);
 if(cached&&cached.first===first&&cached.last===last&&cached.count===count)return cached;
 const units:Unit[]=[],blocks=new Map<number,HTMLElement>(),nonText:HTMLElement[]=[];
 for(const block of Array.from(flow.querySelectorAll<HTMLElement>('[data-block-index]'))){
  const index=Number(block.dataset.blockIndex);
  if(!Number.isSafeInteger(index)||index<0)continue;
  blocks.set(index,block);
  if(block.matches('figure,table,button.book-table-launch'))nonText.push(block);
  const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
  let node:Node|null,number=0;
  while((node=walker.nextNode())){
   const text=node as Text;
   if(text.length>0)units.push({node:text,block:index,textNode:number,length:text.length});
   number++;
  }
 }
 const built={first,last,count,units,blocks,nonText};
 indexes.set(flow,built);
 return built;
}

/** Explicit invalidation when React replaces blocks without remounting flow. */
export function invalidateAnchorIndex(flow:Element):void{indexes.delete(flow)}

/** The returned metadata is immutable for the lifetime of the current chapter. */
export function collectTextUnits(flow:Element):Unit[]{return indexFor(flow).units}

function positionPage(flow:Element,node:Text,index:number,geo:PageGeometry):number|null{
 if(!node.length||geo.width<=0)return null;
 const range=document.createRange();
 const start=Math.min(node.length-1,Math.max(0,Math.trunc(index)));
 range.setStart(node,start);range.setEnd(node,start+1);
 const rect=range.getClientRects().item(0);
 if(!rect||!Number.isFinite(rect.left))return null;
 return columnAtOffset(rect.left-flow.getBoundingClientRect().left,geo);
}

/** Pages without text may still contain a table or missing illustration. */
function nonTextAnchor(flow:Element,page:number,geo:PageGeometry):FB2Anchor|null{
 const left=flow.getBoundingClientRect().left;
 for(const block of indexFor(flow).nonText){
  const rect=block.getBoundingClientRect();
  if(!rect.width||!rect.height)continue;
  const column=columnAtOffset(rect.left-left,geo);
  if(column===page)return {block:Number(block.dataset.blockIndex),textNode:-1,offset:0};
 }
 return null;
}

/** First laid-out character in a column, or its non-text block. */
export function getPageAnchor(flow:Element,page:number,geo:PageGeometry):FB2Anchor|null{
 if(geo.width<=0)return null;
 const desired=Math.max(0,Math.trunc(page));
 const units=indexFor(flow).units;
 if(!units.length)return nonTextAnchor(flow,desired,geo);
 // Text nodes and fragments occur in source order within a CSS multicol flow.
 let lo=0,hi=units.length;
 while(lo<hi){
  const mid=(lo+hi)>>1;
  const unit=units[mid],p=positionPage(flow,unit.node,unit.length-1,geo);
  if(p===null||p<desired)lo=mid+1;else hi=mid;
 }
 if(lo===units.length)return nonTextAnchor(flow,desired,geo);
 const unit=units[lo];
 let start=0,end=unit.length;
 while(start<end){
  const mid=(start+end)>>1;
  const p=positionPage(flow,unit.node,mid,geo);
  if(p===null||p<desired)start=mid+1;else end=mid;
 }
 if(start>=unit.length)return nonTextAnchor(flow,desired,geo);
 return positionPage(flow,unit.node,start,geo)===desired?
  {block:unit.block,textNode:unit.textNode,offset:start}:nonTextAnchor(flow,desired,geo);
}

/** Restore a bookmark after changing font, orientation, or margins. */
export function getAnchorPage(flow:Element,anchor:FB2Anchor,geo:PageGeometry):number|null{
 if(geo.width<=0)return null;
 const block=indexFor(flow).blocks.get(anchor.block);
 if(!block)return null;
 if(anchor.textNode===-1){
  const rect=block.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  return columnAtOffset(rect.left-flow.getBoundingClientRect().left,geo);
 }
 const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
 let node:Node|null,number=0;
 while((node=walker.nextNode())){
  if(number===anchor.textNode){
   const target=node as Text;
   return target.length?positionPage(flow,target,anchor.offset,geo):null;
  }
  number++;
 }
 return null;
}
