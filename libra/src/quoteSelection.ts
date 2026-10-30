import type {ReaderPosition} from './domain';
import type {FB2Anchor} from './anchors';

export type QuoteCapture = {
 text:string;
 position:ReaderPosition;
 endAnchor?:FB2Anchor;
 rect:{left:number;right:number;top:number;bottom:number};
};
function selectedText(selection:Selection|null):{text:string;range:Range}|null{
 if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
 const text=selection.toString().trim();
 if(text.length<2||text.length>5000)return null;
 return {text,range:selection.getRangeAt(0)};
}
function visibleRect(rect:DOMRect):QuoteCapture['rect']|null{
 if(!Number.isFinite(rect.left)||!Number.isFinite(rect.top)||rect.width<=0||rect.height<=0)return null;
 return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};
}
/** The block/text offset survives changed font size and repagination of FB2. */
export function captureFB2Quote(flow:HTMLElement|null,position:ReaderPosition):QuoteCapture|null{
 if(!flow)return null;
 const selected=selectedText(window.getSelection());if(!selected)return null;
 const {range,text}=selected;
 if(!flow.contains(range.startContainer)||!flow.contains(range.endContainer))return null;
 const source=range.startContainer;
 const parent=source.nodeType===Node.TEXT_NODE?source.parentElement:source as Element;
 const block=parent?.closest<HTMLElement>('[data-block-index]');
 if(!block)return null;
 const index=Number(block.dataset.blockIndex);
 if(!Number.isSafeInteger(index)||index<0)return null;
 const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
 let cursor:Node|null,count=0,anchorOffset=0,found=false;
 while((cursor=walker.nextNode())){
  if(cursor===source){anchorOffset=range.startOffset;found=true;break}
  if(source.nodeType===Node.ELEMENT_NODE&&(source as Element).contains(cursor)){
   anchorOffset=0;found=true;break;
  }
  count++;
 }
 if(!found)return null;
 const endParent=range.endContainer.nodeType===Node.TEXT_NODE?range.endContainer.parentElement:range.endContainer as Element;
 const endBlock=endParent?.closest<HTMLElement>('[data-block-index]');
 let endAnchor:FB2Anchor|undefined;
 if(endBlock&&range.endContainer.nodeType===Node.TEXT_NODE){
  const endWalker=document.createTreeWalker(endBlock,NodeFilter.SHOW_TEXT);
  let endNode:Node|null,endIndex=0;
  while((endNode=endWalker.nextNode())){
   if(endNode===range.endContainer){
    endAnchor={block:Number(endBlock.dataset.blockIndex),textNode:endIndex,offset:range.endOffset};break;
   }
   endIndex++;
  }
 }
 const rect=visibleRect(range.getBoundingClientRect());if(!rect)return null;
 return {text,position:{...position,anchor:{block:index,textNode:count,offset:anchorOffset},updatedAt:Date.now()},endAnchor,rect};
}
/** EPUB ranges are converted into stable CFIs when the rendition provides them. */
export function captureEpubQuote(contents:readonly any[],position:ReaderPosition):QuoteCapture|null{
 for(const content of contents){
  const doc:Document|undefined=content?.document;
  if(!doc)continue;
  const selected=selectedText(doc.getSelection?.()??doc.defaultView?.getSelection()??null);if(!selected)continue;
  const {range,text}=selected;
  if(!doc.body?.contains(range.commonAncestorContainer))continue;
  const fallback=range.startContainer.nodeType===Node.TEXT_NODE?range.startContainer.parentElement:range.startContainer as Element;
  const bounds=range.getBoundingClientRect(),first=range.getClientRects()[0];
  const rect=visibleRect(bounds)|| (first?visibleRect(first):null) ||
   (fallback instanceof HTMLElement?visibleRect(fallback.getBoundingClientRect()):null);
  if(!rect)continue;
  const frame=(doc.defaultView?.frameElement as HTMLElement|null)||document.querySelector<HTMLElement>('.epub-mount iframe');
  if(!frame)continue;
  const offset=frame.getBoundingClientRect();
  let cfi=position.cfi;
  try{
   const exact=content.cfiFromRange?.(range);
   if(typeof exact==='string'&&exact.length<=4096)cfi=exact;
  }catch{/* Older EPUB renderers may not expose cfiFromRange. */}
  return {text,position:{...position,cfi,updatedAt:Date.now()},
   rect:{left:rect.left+offset.left,right:rect.right+offset.left,
    top:rect.top+offset.top,bottom:rect.bottom+offset.top}};
 }
 return null;
}
