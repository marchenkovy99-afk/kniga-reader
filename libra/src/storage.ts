import type { ReaderSettings, ReaderPosition, StoredBook } from './domain';
const NAME='libra-library', VERSION=1;
type PersistedBook=Omit<StoredBook,'file'> & {fileBytes:ArrayBuffer;fileType:string;file?:Blob};
let handle: Promise<IDBDatabase> | undefined;

function db():Promise<IDBDatabase>{
 if(!handle)handle=new Promise((resolve,reject)=>{
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
function transaction<T>(store:'books'|'preferences',mode:IDBTransactionMode,
 operation:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 return db().then(database=>new Promise((resolve,reject)=>{
   const tx=database.transaction(store,mode);
   const request=operation(tx.objectStore(store));
   let value:T;
   request.onsuccess=()=>{value=request.result};
   request.onerror=()=>reject(request.error);
   tx.oncomplete=()=>resolve(value);
   tx.onerror=()=>reject(tx.error);
   tx.onabort=()=>reject(tx.error??new Error('Transaction aborted'));
 }));
}
function hydrate(record:PersistedBook|StoredBook):StoredBook{
 // Backward-compatible with already persisted Blob records.
 if('file' in record&&record.file instanceof Blob)return record as StoredBook;
 const raw=record as PersistedBook;
 const {fileBytes,fileType,...metadata}=raw;
 return {...metadata,file:new Blob([fileBytes],{type:fileType||'application/octet-stream'})};
}
export async function listBooks():Promise<StoredBook[]>{
 const records=await transaction<PersistedBook[]>('books','readonly',s=>s.getAll());
 return records.map(hydrate);
}
export async function getBook(id:string):Promise<StoredBook|undefined>{
 const record=await transaction<PersistedBook|undefined>('books','readonly',s=>s.get(id));
 return record?hydrate(record):undefined;
}
export async function saveBook(book:StoredBook):Promise<void>{
 const {file,...metadata}=book;
 // WebKit may reject Blob structured cloning in IndexedDB. Save raw ArrayBuffer instead.
 const record:PersistedBook={...metadata,fileBytes:await file.arrayBuffer(),fileType:file.type};
 await transaction<IDBValidKey>('books','readwrite',s=>s.put(record));
}
export const deleteBook=(id:string)=>transaction<undefined>('books','readwrite',s=>s.delete(id));
export const loadSettings=()=>transaction<ReaderSettings|undefined>('preferences','readonly',s=>s.get('reader'));
export const saveSettings=(settings:ReaderSettings)=>transaction<IDBValidKey>('preferences','readwrite',s=>s.put(settings,'reader'));
function updateMetadata(id:string,change:(existing:PersistedBook)=>PersistedBook):Promise<void>{
 return db().then(database=>new Promise((resolve,reject)=>{
   const tx=database.transaction('books','readwrite'),store=tx.objectStore('books');
   const req=store.get(id);
   req.onsuccess=()=>{if(req.result)store.put(change(req.result))};
   req.onerror=()=>reject(req.error);
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
   tx.onabort=()=>reject(tx.error??new Error('Transaction aborted'));
 }));
}
export async function savePosition(id:string,position:ReaderPosition){
 await updateMetadata(id,existing=>({...existing,position,lastOpenedAt:Date.now()}));
}
export async function toggleBookmark(id:string,position:ReaderPosition){
 await updateMetadata(id,existing=>{
   const key=(p:ReaderPosition)=>[p.chapter,p.page,p.cfi||''].join(':');
   const bookmarks=existing.bookmarks||[];
   const exists=bookmarks.some(p=>key(p)===key(position));
   return {...existing,bookmarks:exists?bookmarks.filter(p=>key(p)!==key(position)):[...bookmarks,position]};
 });
}
