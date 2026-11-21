import type {StoredBook} from './domain';
export type LibraryOrder='recent'|'title'|'author'|'progress';
const collator=new Intl.Collator('ru',{numeric:true,sensitivity:'base'});
export function sortLibraryBooks(books:StoredBook[],order:LibraryOrder):StoredBook[]{
 const recent=(book:StoredBook)=>book.lastOpenedAt||book.importedAt||0;
 return [...books].sort((a,b)=>{
  let difference=0;
  if(order==='title')difference=collator.compare(a.title,b.title);
  else if(order==='author')difference=collator.compare(a.author,b.author);
  else if(order==='progress')difference=(b.position?.fraction||0)-(a.position?.fraction||0);
  else difference=recent(b)-recent(a);
  return difference||collator.compare(a.title,b.title)||a.id.localeCompare(b.id);
 });
}
