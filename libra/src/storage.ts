import type { ReaderSettings, ReaderPosition, StoredBook } from './domain';
const NAME='libra-library', VERSION=1;
let handle: Promise<IDBDatabase> | undefined;

function db(): Promise<IDBDatabase> {
  if (!handle) handle = new Promise((resolve,reject)=>{
    const req=indexedDB.open(NAME,VERSION);
    req.onupgradeneeded=()=>{
      const database=req.result;
      if(!database.objectStoreNames.contains('books'))database.createObjectStore('books',{keyPath:'id'});
      if(!database.objectStoreNames.contains('preferences'))database.createObjectStore('preferences');
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return handle;
}
function transaction<T>(store: 'books'|'preferences', mode: IDBTransactionMode,
  operation: (s: IDBObjectStore)=>IDBRequest<T>): Promise<T> {
  return db().then(database=>new Promise((resolve,reject)=>{
    const tx=database.transaction(store,mode);
    const request=operation(tx.objectStore(store));
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error??new Error('Transaction aborted'));
  }));
}
export const listBooks=()=>transaction<StoredBook[]>('books','readonly',s=>s.getAll());
export const getBook=(id:string)=>transaction<StoredBook|undefined>('books','readonly',s=>s.get(id));
export const saveBook=(book:StoredBook)=>transaction<IDBValidKey>('books','readwrite',s=>s.put(book));
export const deleteBook=(id:string)=>transaction<undefined>('books','readwrite',s=>s.delete(id));
export const loadSettings=()=>transaction<ReaderSettings|undefined>('preferences','readonly',s=>s.get('reader'));
export const saveSettings=(settings:ReaderSettings)=>transaction<IDBValidKey>('preferences','readwrite',s=>s.put(settings,'reader'));
export async function savePosition(id:string,position:ReaderPosition){
  const book=await getBook(id); if(!book)return;
  await saveBook({...book,position,lastOpenedAt:Date.now()});
}
export async function toggleBookmark(id:string,position:ReaderPosition){
  const book=await getBook(id);if(!book)return;
  const key=(p:ReaderPosition)=>[p.chapter,p.page,p.cfi||''].join(':');
  const exists=book.bookmarks.some(p=>key(p)===key(position));
  await saveBook({...book,bookmarks:exists?book.bookmarks.filter(p=>key(p)!==key(position)):[...book.bookmarks,position]});
}
