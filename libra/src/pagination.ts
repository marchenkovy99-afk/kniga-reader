/**
 * Pagination is delegated to the browser's CSS multicolumn fragmenter.
 * The clipped VIEWPORT is purely a page window; the complete DOM remains present.
 * No text is sliced, truncated or dropped to make a page fit.
 */
/**
 * Safari/WebKit can use a fractional actual column stride even when the CSS
 * column width and gap are specified with integral pixel values. The page
 * translation must follow the rendered columns, not the requested width.
 */
export function measureColumnStride(flow:HTMLElement,width:number,gap:number):number{
 const fallback=width+gap;
 if(width<=0)return fallback;
 const left=flow.getBoundingClientRect().left;
 let best=fallback,difference=Infinity;
 for(const element of Array.from(flow.children).slice(0,120)){
  for(const fragment of Array.from(element.getClientRects())){
   if(fragment.width<1||fragment.height<1)continue;
   const x=fragment.left-left;
   const distance=Math.abs(x-fallback);
   if(x>width+gap-8&&distance<Math.min(12,difference)){
    difference=distance;best=x;
   }
  }
  if(difference<.05)break;
 }
 return best;
}
export function measureColumns(scrollWidth:number,viewportWidth:number,gap:number,stride=viewportWidth+gap):number {
  if(viewportWidth<=0)return 1;
  return Math.max(1,Math.round((Math.max(scrollWidth,viewportWidth)+gap)/stride));
}
export function clampPage(requested:number,count:number):number{
  return Math.min(Math.max(0,Math.floor(requested)),Math.max(0,count-1));
}
export function restoreFraction(fraction:number,pageCount:number):number{
  const f=Number.isFinite(fraction)?Math.min(1,Math.max(0,fraction)):0;
  return clampPage(Math.round(f*Math.max(0,pageCount-1)),pageCount);
}
export function progressOf(chapter:number,page:number,pages:number,chapters:number):number{
  return Math.min(100,Math.max(0,Math.round((chapter+page/Math.max(1,pages))/Math.max(1,chapters)*100)));
}
