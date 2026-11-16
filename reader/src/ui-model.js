/** UI-only projections. Never rewrite book blocks or persisted source anchors. */
export const appearancePresets=Object.freeze({
 novel:{fontSize:22,lineHeight:1.55,margin:24,paragraphGap:0,indent:1.3},
 nonfiction:{fontSize:20,lineHeight:1.5,margin:20,paragraphGap:.3,indent:0},
 compact:{fontSize:19,lineHeight:1.35,margin:4,topInset:0,bottomInset:0,paragraphGap:0,indent:.6}
});
export function presetFor(settings){return Object.keys(appearancePresets).find(key=>Object.entries(appearancePresets[key]).every(([field,value])=>settings[field]===value))||'custom';}
export function resetAppearanceSection(settings,tab,defaults){
 const fields={text:['font','fontSize','lineHeight','letterSpacing','paragraphGap','indent','align','hyphens'],page:['margin','topInset','bottomInset'],themes:['theme']};
 const next={...settings};for(const key of fields[tab]||[])next[key]=defaults[key];return next;
}
export function bookProgress(book){
 const a=book.progress?.anchor;if(!a)return 0;
 const before=book.blocks?.slice(0,a.block).reduce((sum,x)=>sum+x.text.length,0)||0;
 return Math.max(0,Math.min(100,Math.round((before+(a.offset||0))/Math.max(1,book.chars||0)*100)));
}
export function filterBooks(books,{query='',status='',sort='recent',collection=''}={}){
 const q=query.trim().toLocaleLowerCase('ru');
 const found=books.filter(b=>(b.title+' '+b.author+' '+(b.progress?.collection||'')).toLocaleLowerCase('ru').includes(q)&&(!status||(b.progress?.status||'reading')===status)&&(!collection||b.progress?.collection===collection));
 return found.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title,'ru'):sort==='author'?a.author.localeCompare(b.author,'ru'):sort==='progress'?bookProgress(b)-bookProgress(a):(b.progress?.updatedAt||b.addedAt||0)-(a.progress?.updatedAt||a.addedAt||0));
}
function decodeLabel(text){
 return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(all,entity)=>{
  const names={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  if(entity[0]!=='#')return names[entity.toLowerCase()]||all;
  const value=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));
  return value>0&&value<=0x10ffff?String.fromCodePoint(value):all;
 });
}
export function chapterLabel(chapter,blocks=[]){
 const block=blocks[chapter.block];
 return block?.html&&/<br\s*\/?\s*>/i.test(block.html)?decodeLabel(block.html.replace(/<br\s*\/?\s*>/gi,' · ').replace(/<[^>]*>/g,'')).replace(/\s+/g,' ').trim():chapter.title||'Без названия';
}
export function searchBook(book,query,limit=50){
 const q=query.trim();if(q.length<2)return {total:0,matches:[]};
 const pattern=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),matches=[];let total=0;
 for(let block=0;block<book.blocks.length;block++){
  const text=book.blocks[block].text,regexp=new RegExp(pattern,'giu');let match;
  while((match=regexp.exec(text))){
   total++;if(matches.length>=limit)continue;
   const offset=match.index,end=offset+match[0].length;
   let from=Math.max(0,offset-40),to=Math.min(text.length,end+80);
   while(from>0&&from<offset&&!/\s/u.test(text[from-1]))from++;
   while(to<text.length&&to>end&&!/\s/u.test(text[to]))to--;
   const chapter=[...(book.chapters||[])].reverse().find(c=>c.block<=block);
   matches.push({block,offset,match:match[0],before:text.slice(from,offset),after:text.slice(end,to),leading:from>0,trailing:to<text.length,chapter:chapter?chapterLabel(chapter,book.blocks):''});
  }
 }
 return {total,matches};
}
export function savedItems(books){
 return books.flatMap(book=>[
  ...(book.marks||[]).filter(m=>!m.deleted).map((m,i)=>({...m,id:`mark:${book.id}:${i}`,type:'bookmark',book,anchor:m.anchor,text:m.label||book.title})),
  ...(book.progress?.annotations||[]).filter(n=>!n.deleted).map(n=>({...n,type:'quote',book,anchor:n.start}))
 ]).sort((a,b)=>(b.changedAt||0)-(a.changedAt||0));
}
export function filterSaved(items,{type='',bookId='',query=''}={}){
 const q=query.trim().toLocaleLowerCase('ru');
 return items.filter(item=>(!type||item.type===type)&&(!bookId||item.book.id===bookId)&&[item.text,item.note,item.book.title,item.book.author].join(' ').toLocaleLowerCase('ru').includes(q));
}
