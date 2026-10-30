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
 const elements=Array.from(flow.children);
 // Use a late page to average Safari's fractional rounding error across
 // many columns. Measuring only the second column can drift by several
 // pixels on page 100 even if the first measurement is off by 0.04px.
 const samples=[...elements.slice(0,20),...elements.slice(-24)];
 let farthest=0,measured=fallback;
 for(const element of samples){
  for(const fragment of Array.from(element.getClientRects())){
   if(fragment.width<1||fragment.height<1)continue;
   const x=fragment.left-left;
   if(x<fallback-12)continue;
   const index=Math.round(x/fallback);
   if(index<1||index<=farthest)continue;
   const step=x/index;
   if(Math.abs(step-fallback)>8)continue;
   farthest=index;measured=step;
  }
 }
 return measured;
}
/**
 * Keep the final page even when scrollWidth rounds down a fractional CSS
 * column. Cross-check the last content fragments against the CSS width.
 * All fragments stay in the DOM; no text is truncated to fit a page.
 */
export function measureRenderedPages(flow:HTMLElement,width:number,gap:number,stride:number):number{
 const byScroll=measureColumns(flow.scrollWidth,width,gap,stride);
 if(width<=0||stride<=0)return byScroll;
 const start=flow.getBoundingClientRect().left;
 let last=byScroll-1;
 const trailing=Array.from(flow.children).slice(-32);
 for(const child of trailing){
  for(const rect of Array.from(child.getClientRects())){
   if(rect.width<.5||rect.height<.5||!Number.isFinite(rect.left))continue;
   const x=Math.max(0,rect.left-start);
   const approx=Math.floor(x/stride);
   const within=x-approx*stride;
   // Fractionally rounded starts near the end of a gap belong to the
   // following column. Do not assign a content fragment to a blank page.
   const page=approx+(within>width+gap*.35?1:0);
   last=Math.max(last,page);
  }
 }
 return Math.max(1,last+1);
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
