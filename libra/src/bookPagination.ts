/** Page numbers are one-based in the interface, zero-based inside chapters. */
export function bookPageLocation(counts:number[],requested:number):{chapter:number;page:number}{
 const total=counts.reduce((sum,n)=>sum+n,0);
 let offset=Math.max(0,Math.min(total-1,Number.isFinite(requested)?Math.floor(requested)-1:0));
 for(let chapter=0;chapter<counts.length;chapter++){
  if(offset<counts[chapter])return {chapter,page:offset};
  offset-=counts[chapter];
 }
 return {chapter:0,page:0};
}
export function bookPageNumber(counts:number[],chapter:number,page:number):number{
 return counts.slice(0,chapter).reduce((sum,n)=>sum+n,0)+page+1;
}

/** Unknown preceding chapter sizes must never produce invented page numbers. */
export function chapterStartPages(counts:readonly number[]):Array<number|undefined>{
 let next=1,known=true;
 return counts.map(count=>{
  const start=known?next:undefined;
  if(!Number.isSafeInteger(count)||count<1)known=false;
  else if(known)next+=count;
  return start;
 });
}

/**
 * Preserve the number the reader actually saw at their saved location.
 * Re-measuring preceding chapters may give a different count on iOS Safari,
 * but must not silently turn saved page 288 into 286.
 */
export function stableBookPageNumber(
 anchor:{chapter:number;page:number;globalPage?:number}|undefined,
 counts:readonly number[],chapter:number,page:number
):number{
 if(anchor?.chapter===chapter&&Number.isSafeInteger(anchor.globalPage)&&
    (anchor.globalPage??0)>0){
  return Math.max(1,anchor.globalPage!+page-anchor.page);
 }
 return bookPageNumber(Array.from(counts),chapter,page);
}


/**
 * Reopen on the same source text, even if iOS Safari fits fewer columns after
 * restoring the standalone PWA. A stored physical page is authoritative only
 * while the measured layout still matches and contains that page.
 */
export function restoredFB2Page(
 saved:{page:number;layoutKey?:string}|undefined,
 layoutKey:string,count:number,anchorPage:number|null,
 anchorPreferred=false
):number{
 const clamp=(n:number)=>Math.max(0,Math.min(Math.max(0,count-1),Math.floor(n)));
 if(!saved)return clamp(anchorPage??0);
 if((anchorPreferred||saved.layoutKey!==layoutKey||saved.page>=count)&&anchorPage!==null)
  return clamp(anchorPage);
 return clamp(saved.page);
}

/** Keep the book-wide number fixed when the same text moves between columns. */
export function rebaseFB2Position<T extends {page:number;globalPage?:number;layoutKey?:string}>(
 position:T,physicalPage:number
):T{
 return position.page===physicalPage?position:{...position,page:physicalPage};
}

/**
 * Some checkpoints produced before book-wide progress was made durable contain
 * chapter/page and the completed chapter-count snapshot, but no globalPage.
 * Recover the displayed number from THAT snapshot, not from a new WebKit
 * pagination pass (which can differ by two pages in a standalone iOS PWA).
 */
export function restoreLogicalFB2Position<T extends {
 chapter:number;page:number;globalPage?:number;pageCounts?:number[]
}>(saved:T|undefined):T|undefined{
 if(!saved||Number.isSafeInteger(saved.globalPage)&&saved.globalPage!>0)return saved;
 const counts=saved.pageCounts;
 if(!counts?.length||saved.chapter>=counts.length||saved.chapter<0||
  !counts.every(n=>Number.isSafeInteger(n)&&n>0)||saved.page<0||
  saved.page>=counts[saved.chapter])return saved;
 return {...saved,globalPage:bookPageNumber(counts,saved.chapter,saved.page)};
}

/** Explicit user pagination always advances the confirmed number by one. */
export function nextLogicalFB2Page(current:number,delta:-1|1):number|undefined{
 return Number.isSafeInteger(current)&&current>0?Math.max(1,current+delta):undefined;
}
