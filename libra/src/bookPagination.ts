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
