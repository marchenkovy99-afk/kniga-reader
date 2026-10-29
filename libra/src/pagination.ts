/**
 * Pagination is delegated to the browser's CSS multicolumn fragmenter.
 * The clipped VIEWPORT is purely a page window; the complete DOM remains present.
 * No text is sliced, truncated or dropped to make a page fit.
 */
export function measureColumns(scrollWidth:number,viewportWidth:number,gap:number):number {
  if(viewportWidth<=0)return 1;
  return Math.max(1,Math.round((Math.max(scrollWidth,viewportWidth)+gap)/(viewportWidth+gap)));
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
