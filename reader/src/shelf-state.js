import * as storage from './storage.js';

/** Serialize local removal and cloud commits so a finishing download cannot
 * race the removal marker or put a removed book back into IndexedDB. */
export function createShelfState(store){
 let writes=Promise.resolve();
 const key=owner=>'cloud-hidden:'+(owner||'guest');
 const read=async owner=>{const value=await store.getPreference(key(owner));return Array.isArray(value)?value:[];};
 const serial=operation=>{const next=writes.then(operation);writes=next.catch(()=>{});return next;};
 const isHidden=async(id,owner)=>{await writes;return (await read(owner)).includes(id);};
 const adoptGuest=owner=>serial(async()=>{
  if(!owner)return;
  const guest=await read(null);if(!guest.length)return;
  await store.setPreference(key(owner),[...new Set([...(await read(owner)),...guest])]);
  await store.deletePreference(key(null));
 });
 const hide=(id,owner,onRemove=()=>{})=>serial(async()=>{
  await store.setPreference(key(owner),[...new Set([...(await read(owner)),id])]);
  const book=(await store.listBooks?.()||[]).find(b=>b.id===id);
  const remaining=[...new Set([...(book?.cloudOwners||[]),book?.cloudOwner].filter(value=>value&&value!==owner))];
  if(book&&remaining.length)await store.putBook({...book,cloudOwner:remaining[0],cloudOwners:remaining});
  else await store.deleteBook(id);
  onRemove();
 });
 const commit=(book,owner,onCommit=()=>{})=>serial(async()=>{
  if((await read(owner)).includes(book.id))return false;
  await store.putBook(book);onCommit(book);return true;
 });
 const restore=(book,owner,onRestore=()=>{})=>serial(async()=>{
  await store.putBook(book);
  for(const scope of new Set([owner||null,null])){
   const hidden=await read(scope);if(hidden.includes(book.id))await store.setPreference(key(scope),hidden.filter(id=>id!==book.id));
  }
  onRestore(book);
 });
 return {isHidden,adoptGuest,hide,commit,restore};
}
export const shelfState=createShelfState(storage);
