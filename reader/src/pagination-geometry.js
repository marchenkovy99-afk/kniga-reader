// scrollHeight/scrollWidth are integers and can miss a clipped fraction of a
// text row. Range rectangles also catch superscripts and nowrap inline runs.
export function visibleContentFits(element){
 if(element.scrollHeight>element.clientHeight||element.scrollWidth>element.clientWidth)return false;
 const box=element.getBoundingClientRect();
 const left=box.left+element.clientLeft,top=box.top+element.clientTop;
 const right=left+element.clientWidth,bottom=top+element.clientHeight;
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
