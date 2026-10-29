import type { ReaderSettings, ReaderPosition, StoredBook } from './domain';

/**
 * V2 keeps imported bytes in 'books' and high-frequency reader state in
 * 'reading'. Page flips never rewrite a large ArrayBuffer.
 * The upgrade copies existing positions/bookmarks in the same IDB transaction.
 */
const NAME='libra-library', VERSION=2;
type PersistedBook=Omit<StoredBook,'file'> & {fileBytes:ArrayBuffer;fileType:string;file?:Blob};
type ReadingState={id:string;position?:ReaderPosition;bookmarks:ReaderPosition[];lastOpenedAt?:number};
let handle:Promise<IDBDatabase>|undefined;

function db():Promise<IDBDatabase>{
 if(!handle)handle=new Promise((resolve,reject)=>{
  const req=indexedDB.open(NAME,VERSION);
  req.onupgradeneeded=()=>{
   const database=req.result;
   if(!database.objectStoreNames.contains('books'))database.createObjectStore('books',{keyPath:'id'});
   if(!database.objectStoreNames.contains('preferences'))database.createObjectStore('preferences');
   if(!database.objectStoreNames.contains('reading')){
    const reading=database.createObjectStore('reading',{keyPath:'id'});
    const books=req.transaction!.objectStore('books');
    const cursor=books.openCursor();
    cursor.onsuccess=()=>{
     const current=cursor.result;if(!current)return;
     const item=current.value as PersistedBook;
     if(item.position||item.lastOpenedAt||(item.bookmarks?.length??0)>0){
      reading.put({id:item.id,position:item.position,bookmarks:item.bookmarks||[],
       lastOpenedAt:item.lastOpenedAt} satisfies ReadingState);
     }
     current.continue();
    };
   }
  };
  req.onsuccess=()=>{
   const database=req.result;
   database.onversionchange=()=>{database.close();handle=undefined};
   resolve(database);
  };
  req.onerror=()=>{handle=undefined;reject(req.error)};
  req.onblocked=()=>{handle=undefined;reject(new Error('Закройте другие вкладки LIBRA для обновления хранилища'))};
 });
 return handle;
}
function transaction<T>(store:'books'|'preferences'|'reading',mode:IDBTransactionMode,
 operation:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 return db().then(database=>new Promise((resolve,reject)=>{
  const tx=database.transaction(store,mode),req=operation(tx.objectStore(store));
  let value:T;
  req.onsuccess=()=>{value=req.result};
  req.onerror=()=>reject(req.error);
  tx.oncomplete=()=>resolve(value);
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error??new Error('Transaction aborted'));
 }));
}
function hydrate(record:PersistedBook|StoredBook,state?:ReadingState):StoredBook{
 const original=('file' in record && record.file instanceof Blob)?
  record as StoredBook:(()=>{
   const {fileBytes,fileType,...metadata}=record as PersistedBook;
   return {...metadata,file:new Blob([fileBytes],{type:fileType||'application/octet-stream'})};
  })();
 return {...original,position:state?.position??original.position,
  bookmarks:state?.bookmarks??original.bookmarks??[],
  lastOpenedAt:state?.lastOpenedAt??original.lastOpenedAt};
}
export async function listBooks():Promise<StoredBook[]>{
 const [records,states]=await Promise.all([
  transaction<PersistedBook[]>('books','readonly',s=>s.getAll()),
  transaction<ReadingState[]>('reading','readonly',s=>s.getAll())
 ]);
 const byId=new Map(states.map(state=>[state.id,state]));
 return records.map(record=>hydrate(record,byId.get(record.id)));
}
export async function getBook(id:string):Promise<StoredBook|undefined>{
 const [record,state]=await Promise.all([
  transaction<PersistedBook|undefined>('books','readonly',s=>s.get(id)),
  transaction<ReadingState|undefined>('reading','readonly',s=>s.get(id))
 ]);
 return record?hydrate(record,state):undefined;
}
export async function saveBook(book:StoredBook):Promise<void>{
 const {file,...metadata}=book;
 const record:PersistedBook={...metadata,fileBytes:await file.arrayBuffer(),fileType:file.type};
 await transaction<IDBValidKey>('books','readwrite',s=>s.put(record));
}
/** Delete both file and reading state as one atomic operation. */
export function deleteBook(id:string):Promise<void>{
 return db().then(database=>new Promise((resolve,reject)=>{
  const tx=database.transaction(['books','reading'],'readwrite');
  tx.objectStore('books').delete(id);
  tx.objectStore('reading').delete(id);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error??new Error('Deletion aborted'));
 }));
}
export const loadSettings=()=>transaction<ReaderSettings|undefined>('preferences','readonly',s=>s.get('reader'));
export const saveSettings=(settings:ReaderSettings)=>transaction<IDBValidKey>('preferences','readwrite',s=>s.put(settings,'reader'));
function updateReading(id:string,transform:(state:ReadingState)=>ReadingState):Promise<void>{
 return db().then(database=>new Promise((resolve,reject)=>{
  const tx=database.transaction('reading','readwrite'),store=tx.objectStore('reading');
  const req=store.get(id);
  req.onsuccess=()=>{
   const old:ReadingState=req.result??{id,bookmarks:[]};
   store.put(transform(old));
  };
  req.onerror=()=>reject(req.error);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error??new Error('Reading state write aborted'));
 }));
}
export function savePosition(id:string,position:ReaderPosition){
 return updateReading(id,old=>({...old,position,lastOpenedAt:Date.now()}));
}
export function toggleBookmark(id:string,position:ReaderPosition){
 return updateReading(id,old=>{
  const key=(p:ReaderPosition)=>p.cfi??[p.chapter,p.anchor?.block,p.anchor?.textNode,p.anchor?.offset,p.page].join(':');
  const bookmarks=old.bookmarks||[];
  const exists=bookmarks.some(p=>key(p)===key(position));
  return {...old,bookmarks:exists?bookmarks.filter(p=>key(p)!==key(position)):[...bookmarks,position]};
 });
}
