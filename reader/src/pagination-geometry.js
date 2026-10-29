import {readerPaintHeight} from './reader-window.js';
// scrollHeight/scrollWidth are integers and can miss a clipped fraction of a
// text row. Range rectangles also catch superscripts and nowrap inline runs.
export function visibleContentFits(element,clip=element){
 if(element.scrollHeight>element.clientHeight||element.scrollWidth>element.clientWidth)return false;
 const box=element.getBoundingClientRect();
 const clipBox=clip.getBoundingClientRect();
 const contentLeft=box.left+element.clientLeft,contentTop=box.top+element.clientTop;
 const clipLeft=clipBox.left+clip.clientLeft,clipTop=clipBox.top+clip.clientTop;
 let left=Math.max(contentLeft,clipLeft),top=Math.max(contentTop,clipTop);
 let right=Math.min(contentLeft+element.clientWidth,clipLeft+clip.clientWidth),bottom=Math.min(contentTop+element.clientHeight,clipTop+clip.clientHeight);
 // A flipbook page or its intermediate layers can crop glyphs even when
 // the full book stage still has room. Intersect every clipping ancestor
 // between the text and its requested viewport, including transformed pages.
 const doc=element.ownerDocument,view=doc.defaultView;
 if(clip!==element){
  for(let ancestor=element.parentElement;ancestor&&ancestor!==clip;ancestor=ancestor.parentElement){
   const style=view?.getComputedStyle?.(ancestor);
   const clipsX=/^(hidden|clip|scroll|auto)$/.test(style?.overflowX||'');
   const clipsY=/^(hidden|clip|scroll|auto)$/.test(style?.overflowY||'');
   if(!clipsX&&!clipsY)continue;
   const bounds=ancestor.getBoundingClientRect();
   if(clipsX){left=Math.max(left,bounds.left+ancestor.clientLeft);right=Math.min(right,bounds.left+ancestor.clientLeft+ancestor.clientWidth);}
   if(clipsY){top=Math.max(top,bounds.top+ancestor.clientTop);bottom=Math.min(bottom,bounds.top+ancestor.clientTop+ancestor.clientHeight);}
  }
 }
 if(clip!==element&&view){
  const visual=view.visualViewport,paintHeight=readerPaintHeight(view,doc);
  // Only a genuinely restricted visual viewport clips a standalone page.
  // A transient iOS visualViewport under-report must not hide valid bottom rows.
  const visualClips=!(visual?.height>0&&paintHeight>visual.height+1);
  left=Math.max(left,visual?.offsetLeft||0);top=Math.max(top,visualClips?(visual?.offsetTop||0):0);
  right=Math.min(right,view.innerWidth,visual?.width>0?(visual.offsetLeft||0)+visual.width:view.innerWidth);
  bottom=Math.min(bottom,paintHeight,visualClips&&visual?.height>0?(visual.offsetTop||0)+visual.height:paintHeight);
 }
 const epsilon=1/64;
 const fits=rect=>rect.width<=0||rect.height<=0||
  (rect.left>=left-epsilon&&rect.top>=top-epsilon&&rect.right<=right+epsilon&&rect.bottom<=bottom+epsilon);
 const range=doc.createRange(),walker=doc.createTreeWalker(element,4);let node;
 while(node=walker.nextNode()){
  if(!node.data.trim())continue;
  range.selectNodeContents(node);
  for(const rect of range.getClientRects())if(!fits(rect))return false;
 }
 // Empty marker spans draw a generated hyphen absent from the source text.
 // Replaced content and tables have no complete set of text Range rectangles.
 for(const item of element.querySelectorAll('img,table,.book-page-hyphen,.book-hyphen'))if(!fits(item.getBoundingClientRect()))return false;
 return true;
}
