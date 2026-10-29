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
 const view=element.ownerDocument.defaultView;
 if(clip!==element&&view){
  const visual=view.visualViewport;
  left=Math.max(left,visual?.offsetLeft||0);top=Math.max(top,visual?.offsetTop||0);
  right=Math.min(right,view.innerWidth,visual?.width>0?(visual.offsetLeft||0)+visual.width:view.innerWidth);
  bottom=Math.min(bottom,view.innerHeight,visual?.height>0?(visual.offsetTop||0)+visual.height:view.innerHeight);
 }
 const epsilon=1/64;
 const fits=rect=>rect.width<=0||rect.height<=0||
  (rect.left>=left-epsilon&&rect.top>=top-epsilon&&rect.right<=right+epsilon&&rect.bottom<=bottom+epsilon);
 const doc=element.ownerDocument,range=doc.createRange(),walker=doc.createTreeWalker(element,4);let node;
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
