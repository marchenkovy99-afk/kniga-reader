import {pageForAnchor} from './anchors.js';

/** Remaining screen pages include the page currently being read. */
export function chapterReadingStatus(pages,pageIndex,chapters=[]){
 if(!pages.length)return null;
 const index=Math.max(0,Math.min(pages.length-1,pageIndex));
 const main=chapters.some(c=>c.level===1)?chapters.filter(c=>c.level===1):chapters;
 const headings=[...main].sort((a,b)=>a.block-b.block),block=pages[index].start.block;
 const active=headings.findLast(c=>c.block<=block),next=headings.find(c=>c.block>block);
 const until=next?pageForAnchor(pages,{block:next.block,offset:0}):pages.length;
 const remainingPages=Math.max(1,until-index);
 const prefix=!headings.length?'До конца книги':active?'До конца главы':'До начала главы';
 return {title:active?.title||'',remainingPages,label:`${prefix} · ${remainingPages} стр.`};
}

/** Merge stable IDs and deletion tombstones for synced quote annotations. */
export function mergeAnnotations(...groups){
 const map=new Map();
 for(const x of groups.flat()){
  if(!x||typeof x.id!=='string'||x.id.length>90||!x.start||!x.end)continue;
  if(!Number.isInteger(x.start.block)||!Number.isInteger(x.end.block)||!Number.isInteger(x.start.offset)||!Number.isInteger(x.end.offset))continue;
  if(x.start.block<0||x.end.block<x.start.block||x.start.offset<0||x.end.offset<0)continue;
  const older=map.get(x.id);
  if(!older||(Number(x.changedAt)||0)>=(Number(older.changedAt)||0))map.set(x.id,{
   id:x.id,start:{block:x.start.block,offset:x.start.offset},end:{block:x.end.block,offset:x.end.offset},
   text:String(x.text||'').slice(0,3000),note:String(x.note||'').slice(0,5000),
   color:['gold','mint','rose'].includes(x.color)?x.color:'gold',deleted:!!x.deleted,changedAt:Number(x.changedAt)||0
  });
 }
 return [...map.values()].slice(-500);
}
