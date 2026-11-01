import {chapterStartPages} from '../bookPagination';
/**
 * EPUB2 (NCX) and EPUB3 (nav.xhtml) both expose nested epub.js toc entries.
 * Keep the full href for navigation and a readable, flat chapter list for UI.
 */
export type EpubChapter={title:string;href:string};
type NavigationItem={label?:string;href?:string;subitems?:NavigationItem[]};
export function flattenEpubToc(source:NavigationItem[],limit=500):EpubChapter[]{
 const output:EpubChapter[]=[];
 function visit(items:NavigationItem[],depth:number){
  if(depth>15)return;
  for(const item of items){
   if(output.length>=limit)return;
   if(typeof item.href==='string'&&item.href.trim()){
    const title=(item.label||'').trim()||'Без названия';
    output.push({title,href:item.href});
   }
   if(Array.isArray(item.subitems))visit(item.subitems,depth+1);
  }
 }
 visit(source,0);
 return output;
}
function pathOnly(href:string):string{
 const plain=href.split('#',1)[0].split('?',1)[0];
 try{return decodeURIComponent(plain).replace(/^\.\//,'').replace(/^\//,'')}catch{return plain.replace(/^\.\//,'')}
}
export function chapterForHref(href:unknown,chapters:EpubChapter[]):number{
 if(typeof href!=='string'||!href||!chapters.length)return 0;
 const path=pathOnly(href);
 let found=chapters.findIndex(c=>pathOnly(c.href)===path);
 if(found<0)found=chapters.findIndex(c=>path.endsWith('/'+pathOnly(c.href)));
 // Most EPUB2 NCX entries have hrefs relative to the OPF document.
 if(found<0){
  const base=path.split('/').at(-1);
  found=chapters.findIndex(c=>pathOnly(c.href).split('/').at(-1)===base);
 }
 return Math.max(0,found);
}

/** Use only the measured physical page at each EPUB TOC anchor. */
export function epubTocStartPages(
 spine:readonly {index:number}[],counts:Record<number,number>,
 anchors:Record<number,{index:number;page:number}>,chapterCount:number
):Array<number|undefined>{
 const starts=chapterStartPages(spine.map(section=>counts[section.index]||0));
 return Array.from({length:chapterCount},(_,chapter)=>{
  const anchor=anchors[chapter];if(!anchor)return undefined;
  const section=spine.findIndex(item=>item.index===anchor.index);
  if(section<0||starts[section]===undefined||!Number.isSafeInteger(anchor.page)||
    anchor.page<1||anchor.page>counts[anchor.index])return undefined;
  return starts[section]!+anchor.page-1;
 });
}
