import type { ReaderSettings, ReaderPosition, StoredBook, SavedQuote } from './domain';
import {sameBookmark} from './bookmarks';
import {traceReading} from './readingDiagnostics';

/**
 * V3 adds the durable cloud outbox; V2 keeps imported bytes in 'books' and high-frequency reader state in
 * 'reading'. Page flips never rewrite a large ArrayBuffer.
 * The upgrade copies existing positions/bookmarks in the same IDB transaction.
 */
const NAME='libra-library', VERSION=3;
type PersistedBook=Omit<StoredBook,'file'> & {fileBytes:ArrayBuffer;fileType:string;file?:Blob};
export type CloudEntry={id:string;owner:string;key:string;revision:number;pending:boolean;generation:number;deleted?:boolean};
let activeOwner:string|null=null;
let cloudEnabled=false;
const listeners=new Set<()=>void>();
export function onStorageChange(fn:()=>void){listeners.add(fn);return ()=>{listeners.delete(fn)}}
function changed(){for(const fn of listeners)fn()}
function queue(tx:IDBTransaction,key:string,deleted=false){
 if(!activeOwner||!cloudEnabled)return;
 const owner=activeOwner,store=tx.objectStore('cloud'),id=owner+'|'+key,req=store.get(id);
 req.onsuccess=()=>{const old=req.result as CloudEntry|undefined;if(old?.deleted&&!deleted)return;store.put({id,owner,key,revision:old?.revision??0,pending:true,generation:(old?.generation??0)+1,deleted} satisfies CloudEntry)};
}
type ReadingState={id:string;position?:ReaderPosition;bookmarks:ReaderPosition[];quotes?:SavedQuote[];lastOpenedAt?:number};
/** Synchronous reading checkpoint for iOS, where background IDB writes may be suspended. */
type ReadingSession={bookId:string;position?:ReaderPosition};
let activeReadingId:string|null=null;
let activeReadingKey:string|null=null;
const readingSessionKey=()=> 'libra-last-reading-v1:'+encodeURIComponent(activeOwner||'guest');
const checkpointKey=(id:string)=>'libra-book-position-v2:'+encodeURIComponent(activeOwner||'guest')+':'+encodeURIComponent(id);
function validPosition(p:ReaderPosition):boolean{
 return Number.isSafeInteger(p.chapter)&&p.chapter>=0&&
  Number.isSafeInteger(p.page)&&p.page>=0&&Number.isFinite(p.updatedAt);
}
/** Per-book synchronous checkpoint, retained when the reader goes back to the library. */
export function readBookCheckpoint(id:string):ReaderPosition|undefined{
 try{
  const raw=localStorage.getItem(checkpointKey(id));
  const value=raw?JSON.parse(raw) as ReaderPosition:null;
  return value&&validPosition(value)?value:undefined;
 }catch{return undefined}
}
function writeBookCheckpoint(id:string,position:ReaderPosition){
 try{localStorage.setItem(checkpointKey(id),JSON.stringify(position))}catch{}
}
export function freshestPosition(id:string,persisted?:ReaderPosition):ReaderPosition|undefined{
 const local=readBookCheckpoint(id);
 const selected=local&&(!persisted||local.updatedAt>=persisted.updatedAt)?local:persisted;
 traceReading('position.resolve',{id,checkpointPage:local?.page,checkpointTime:local?.updatedAt,
  storedPage:persisted?.page,storedTime:persisted?.updatedAt,selectedPage:selected?.page,
  selectedTime:selected?.updatedAt,selectedGlobal:selected?.globalPage});
 return selected;
}
function readSession():ReadingSession|null{
 try{
  const value=localStorage.getItem(readingSessionKey());
  if(!value)return null;
  const session=JSON.parse(value) as ReadingSession;
  if(typeof session.bookId!=='string'||!session.bookId||session.bookId.length>200)return null;
  const p=session.position;
  if(p&&!validPosition(p))return null;
  return session;
 }catch{return null}
}
function writeSession(session:ReadingSession){
 try{localStorage.setItem(readingSessionKey(),JSON.stringify(session))}catch{/* IndexedDB remains the durable fallback. */}
}
export async function loadReadingSession():Promise<ReadingSession|null>{
 await db();const session=readSession();
 traceReading('session.load',{id:session?.bookId,page:session?.position?.page,
  globalPage:session?.position?.globalPage,updatedAt:session?.position?.updatedAt});
 return session;
}
export function activateReadingSession(id:string,position?:ReaderPosition):ReaderPosition|undefined{
 activeReadingId=id;activeReadingKey=readingSessionKey();
 const current=freshestPosition(id,position);
 traceReading('session.activate',{id,page:current?.page,globalPage:current?.globalPage,updatedAt:current?.updatedAt});
 if(current)writeBookCheckpoint(id,current);
 writeSession({bookId:id,position:current});
 return current;
}
export function deactivateReadingSession(){
 activeReadingId=null;
 try{localStorage.removeItem(activeReadingKey||readingSessionKey())}catch{}
 activeReadingKey=null;
}
let handle:Promise<IDBDatabase>|undefined;

function db():Promise<IDBDatabase>{
 if(!handle)handle=new Promise((resolve,reject)=>{
  const req=indexedDB.open(NAME,VERSION);
  req.onupgradeneeded=()=>{
   const database=req.result;
   if(!database.objectStoreNames.contains('cloud'))database.createObjectStore('cloud',{keyPath:'id'});
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
   const tx=database.transaction('preferences','readonly');
   const pref=tx.objectStore('preferences').get('cloud-device');
   pref.onsuccess=()=>{activeOwner=pref.result?.owner??null;cloudEnabled=pref.result?.enabled??false;resolve(database)};
   pref.onerror=()=>resolve(database);
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
 return {...original,position:freshestPosition(original.id,state?.position??original.position),
  bookmarks:state?.bookmarks??original.bookmarks??[],quotes:state?.quotes??original.quotes??[],
  lastOpenedAt:state?.lastOpenedAt??original.lastOpenedAt};
}
export async function listBooks():Promise<StoredBook[]>{
 const [records,states]=await Promise.all([
  transaction<PersistedBook[]>('books','readonly',s=>s.getAll()),
  transaction<ReadingState[]>('reading','readonly',s=>s.getAll())
 ]);
 const byId=new Map(states.map(state=>[state.id,state]));
 const bindings=await allCloudEntries();
 return records.filter(record=>visible(record.id,bindings)).map(record=>hydrate(record,byId.get(record.id)));
}
export async function getBook(id:string):Promise<StoredBook|undefined>{
 const [record,state]=await Promise.all([
  transaction<PersistedBook|undefined>('books','readonly',s=>s.get(id)),
  transaction<ReadingState|undefined>('reading','readonly',s=>s.get(id))
 ]);
 return record&&visible(id,await allCloudEntries())?hydrate(record,state):undefined;
}
export async function saveBook(book:StoredBook):Promise<void>{
 const {file,...metadata}=book;
 const record:PersistedBook={...metadata,fileBytes:await file.arrayBuffer(),fileType:file.type};
 const database=await db();
 await new Promise<void>((resolve,reject)=>{const tx=database.transaction(['books','cloud'],'readwrite');tx.objectStore('books').put(record);queue(tx,'book:'+book.id);tx.oncomplete=()=>{changed();resolve()};tx.onerror=()=>reject(tx.error)});
}
/** Delete both file and reading state as one atomic operation. */
export function deleteBook(id:string):Promise<void>{
 // A deleted book must not be resurrected by a stale reading checkpoint.
 try{localStorage.removeItem(checkpointKey(id))}catch{}
 return db().then(database=>new Promise((resolve,reject)=>{
  const tx=database.transaction(['books','reading','cloud'],'readwrite');
  tx.objectStore('books').delete(id);
  tx.objectStore('reading').delete(id);
  queue(tx,'book:'+id,true);
  tx.oncomplete=()=>{changed();resolve()};
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error??new Error('Deletion aborted'));
 }));
}
export async function loadSettings(){await db();const key=activeOwner?'reader:'+activeOwner:'reader';return transaction<ReaderSettings|undefined>('preferences','readonly',s=>s.get(key))}
export async function saveSettings(settings:ReaderSettings){
 const database=await db(),owner=activeOwner,key=owner?'reader:'+owner:'reader';return new Promise<void>((resolve,reject)=>{const tx=database.transaction(['preferences','cloud'],'readwrite'),store=tx.objectStore('preferences'),req=store.get(key);req.onsuccess=()=>{if(owner!==activeOwner||JSON.stringify(req.result)===JSON.stringify(settings))return;store.put(settings,key);queue(tx,'settings')};tx.oncomplete=()=>{changed();resolve()};tx.onerror=()=>reject(tx.error)});
}
function updateReading(id:string,transform:(state:ReadingState)=>ReadingState):Promise<ReadingState>{
 return db().then(database=>new Promise((resolve,reject)=>{
  const owner=activeOwner,tx=database.transaction(['reading','cloud'],'readwrite'),store=tx.objectStore('reading');
  let result:ReadingState={id,bookmarks:[]};
  const bindings=tx.objectStore('cloud').getAll();
  bindings.onsuccess=()=>{
   if(owner!==activeOwner||!visible(id,bindings.result as CloudEntry[]))return;
   const req=store.get(id);
   req.onsuccess=()=>{
    const old:ReadingState=req.result??{id,bookmarks:[]};result=old;
    if(owner!==activeOwner)return;
    result=transform(old);store.put(result);queue(tx,'book:'+id);
   };
  };
  tx.oncomplete=()=>{changed();resolve(result)};
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error??new Error('Reading state write aborted'));
 }));
}
/**
 * A delayed page-flip write must never replace a newer reading location.
 * This can happen when a device suspends a tab during an asynchronous write
 * or when an earlier EPUB relocation resolves after a later navigation.
 *
 * For equal timestamps we keep the later queued event (IDB serializes the
 * readwrite transactions), preserving fast consecutive taps within one ms.
 */
export function newestReadingPosition(current:ReaderPosition|undefined,next:ReaderPosition):ReaderPosition{
 return current && current.updatedAt>next.updatedAt?current:next;
}
export function savePosition(id:string,position:ReaderPosition){
 traceReading('position.commit.request',{id,active:activeReadingId===id,chapter:position.chapter,
  page:position.page,globalPage:position.globalPage,updatedAt:position.updatedAt,layoutKey:position.layoutKey});
 // Checkpoint every confirmed reading location synchronously, including when
 // iOS has already suspended/cleared the active reading-session flag.
 // Only the per-book checkpoint is updated for inactive books; do not resurrect
 // an old active session or overwrite a newer checkpoint.
 const session=activeReadingId===id?readSession():null;
 const previous=freshestPosition(id,session?.bookId===id?session.position:undefined);
 if(!previous||previous.updatedAt<=position.updatedAt){
  writeBookCheckpoint(id,position);
  if(activeReadingId===id)writeSession({bookId:id,position});
  traceReading('position.checkpoint.written',{id,page:position.page,
   globalPage:position.globalPage,updatedAt:position.updatedAt,active:activeReadingId===id});
 }
 return updateReading(id,old=>{
  if(old.position && old.position.updatedAt>position.updatedAt)return old;
  return {...old,position:newestReadingPosition(old.position,position),
   lastOpenedAt:Math.max(old.lastOpenedAt??0,Date.now())};
 }).then(state=>{
  traceReading('position.idb.complete',{id,page:state.position?.page,
   globalPage:state.position?.globalPage,updatedAt:state.position?.updatedAt});
  return state;
 });
}
export async function toggleBookmark(id:string,position:ReaderPosition):Promise<ReaderPosition[]>{
 const updated=await updateReading(id,old=>{
  const bookmarks=old.bookmarks||[];
  const exists=bookmarks.some(saved=>sameBookmark(saved,position));
  return {...old,bookmarks:exists?
   bookmarks.filter(saved=>!sameBookmark(saved,position)):
   [...bookmarks,position]};
 });
 return updated.bookmarks;
}

/** Quotes live with the book's lightweight reading state, not the binary book file. */
export async function addQuote(id:string,quote:SavedQuote):Promise<SavedQuote[]>{
 if(!quote.text.trim()||quote.text.length>5000)throw Error('Выделите фрагмент до 5000 символов');
 const updated=await updateReading(id,old=>({
  ...old,quotes:[...(old.quotes||[]).filter(saved=>saved.id!==quote.id),quote].slice(-2000)
 }));
 return updated.quotes||[];
}
export async function removeQuote(id:string,quoteId:string):Promise<SavedQuote[]>{
 const updated=await updateReading(id,old=>({...old,quotes:(old.quotes||[]).filter(quote=>quote.id!==quoteId)}));
 return updated.quotes||[];
}

/**
 * Additive, atomic restore: never overwrite local books, reading state or
 * preferences. The caller validates checksums before starting the transaction.
 */
export async function mergeBackupBooks(books:StoredBook[]):Promise<{added:number;skipped:number}>{
 const records=await Promise.all(books.map(async book=>{
  const {file,...meta}=book;
  return {meta,bytes:await file.arrayBuffer(),mime:file.type};
 }));
 const database=await db();
 return new Promise((resolve,reject)=>{
  const tx=database.transaction(['books','reading','cloud'],'readwrite');
  const bookStore=tx.objectStore('books'),stateStore=tx.objectStore('reading');
  let added=0,skipped=0;
  for(const record of records){
   const req=bookStore.get(record.meta.id);
   req.onsuccess=()=>{
    if(req.result){skipped++;return}
    const {meta,bytes,mime}=record;
    bookStore.add({...meta,fileBytes:bytes,fileType:mime} satisfies PersistedBook);
    stateStore.put({id:meta.id,position:meta.position,
     bookmarks:meta.bookmarks||[],quotes:meta.quotes||[],lastOpenedAt:meta.lastOpenedAt} satisfies ReadingState);
    queue(tx,'book:'+meta.id);
    added++;
   };
  }
  tx.oncomplete=()=>{changed();resolve({added,skipped})};
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error??new Error('Восстановление не удалось'));
 });
}

function allCloudEntries(){return db().then(database=>new Promise<CloudEntry[]>((resolve,reject)=>{const req=database.transaction('cloud').objectStore('cloud').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)}))}
function visible(id:string,entries:CloudEntry[]){const bindings=entries.filter(r=>r.key==='book:'+id);return !bindings.length||bindings.some(r=>r.owner===activeOwner&&!r.deleted)}
export async function getCloudEntries(owner:string){return (await allCloudEntries()).filter(r=>r.owner===owner)}
export async function cloudDeviceState(){await db();return {owner:activeOwner,enabled:cloudEnabled,hidden:(await allCloudEntries()).some(r=>r.owner!==activeOwner)}}
export async function setCloudAccount(owner:string|null){
 await db();if(owner!==activeOwner)cloudEnabled=owner?!!(await transaction('preferences','readonly',s=>s.get('cloud-enabled:'+owner))):false;activeOwner=owner;
 await transaction('preferences','readwrite',s=>s.put({owner,enabled:cloudEnabled},'cloud-device'));changed();
}
/** Explicitly attach only unowned device books; other accounts are never adopted. */
export async function attachLocalLibrary(owner:string){
 if(owner!==activeOwner)throw Error('Учётная запись изменилась');
 const entries=await allCloudEntries(),books=await listBooks();const database=await db();
 cloudEnabled=true;
 await new Promise<void>((resolve,reject)=>{const tx=database.transaction(['cloud','preferences'],'readwrite');
 tx.objectStore('preferences').put({owner,enabled:true},'cloud-device');tx.objectStore('preferences').put(true,'cloud-enabled:'+owner);
 for(const book of books)if(!entries.some(r=>r.key==='book:'+book.id))queue(tx,'book:'+book.id);
 if(!entries.some(r=>r.owner===owner&&r.key==='settings')){
  const preferences=tx.objectStore('preferences'),owned=preferences.get('reader:'+owner);
  owned.onsuccess=()=>{
   if(owner!==activeOwner)return;
   if(owned.result!==undefined){queue(tx,'settings');return}
   const anonymous=preferences.get('reader');
   anonymous.onsuccess=()=>{if(owner!==activeOwner)return;if(anonymous.result!==undefined){preferences.put(anonymous.result,'reader:'+owner);queue(tx,'settings')}};
  };
 }
 tx.oncomplete=()=>{changed();resolve()};tx.onerror=()=>reject(tx.error)});
}
export async function acknowledgeCloudEntry(sent:CloudEntry,revision:number){
 const database=await db();await new Promise<void>((resolve,reject)=>{const tx=database.transaction('cloud','readwrite'),store=tx.objectStore('cloud'),req=store.get(sent.id);
 req.onsuccess=()=>{const now=req.result as CloudEntry|undefined;if(now)store.put({...now,revision,pending:now.generation!==sent.generation})};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});
}
export async function archiveCloudBook(owner:string,id:string,revision:number){
 const entry:CloudEntry={id:owner+'|book:'+id,owner,key:'book:'+id,revision,pending:false,generation:0,deleted:true};
 const database=await db();await new Promise<void>((resolve,reject)=>{const tx=database.transaction('cloud','readwrite');tx.objectStore('cloud').put(entry);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});changed();
}
/** Applies server state only if no local edit arrived while downloading. */
export async function applyCloudRecord(owner:string,key:string,revision:number,book?:StoredBook,settings?:ReaderSettings,expectedGeneration?:number){
 if(owner!==activeOwner)throw Error('Учётная запись изменилась');
 const entries=await allCloudEntries();
 if(book&&entries.some(r=>r.key===key&&r.owner!==owner))throw Error('Книга принадлежит другой учётной записи на устройстве');
 const bytes=book?await book.file.arrayBuffer():undefined,database=await db();
 return new Promise<boolean>((resolve,reject)=>{const tx=database.transaction(['books','reading','preferences','cloud'],'readwrite'),store=tx.objectStore('cloud'),id=owner+'|'+key,req=store.get(id);let applied=false;
 req.onsuccess=()=>{if(owner!==activeOwner)return;const old=req.result as CloudEntry|undefined;if(old?.pending&&old.generation!==expectedGeneration)return;if(old?.deleted)return;
 if(book){const {file,...meta}=book;tx.objectStore('books').put({...meta,fileBytes:bytes!,fileType:file.type});tx.objectStore('reading').put({id:book.id,position:book.position,bookmarks:book.bookmarks,quotes:book.quotes||[],lastOpenedAt:book.lastOpenedAt})}
 if(settings)tx.objectStore('preferences').put(settings,'reader:'+owner);
 store.put({id,owner,key,revision,pending:false,generation:old?.generation??0} satisfies CloudEntry);applied=true};
 tx.oncomplete=()=>resolve(applied);tx.onerror=()=>reject(tx.error)});
}

/** Persist a favorite flag atomically without loading or rewriting book bytes. */
export async function setBookFavorite(id:string,isFavorite:boolean):Promise<void>{
 const database=await db();
 await new Promise<void>((resolve,reject)=>{
  const tx=database.transaction(['books','cloud'],'readwrite');
  const store=tx.objectStore('books');
  const req=store.get(id);
  req.onsuccess=()=>{
   const book=req.result as PersistedBook|undefined;
   if(!book){tx.abort();return}
   store.put({...book,isFavorite});
   queue(tx,'book:'+id);
  };
  tx.oncomplete=()=>{changed();resolve()};
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error??new Error('Книга не найдена'));
 });
}

/** Restore artwork without deleting book bytes, reading progress or bookmarks. */
export async function updateBookCover(id:string,cover:string):Promise<void>{
 if(!cover.startsWith('data:image/')||cover.length>2_100_000)return;
 const database=await db();
 await new Promise<void>((resolve,reject)=>{
  const tx=database.transaction(['books','cloud'],'readwrite');
  const store=tx.objectStore('books'),req=store.get(id);
  req.onsuccess=()=>{
   const book=req.result as PersistedBook|undefined;
   if(!book||book.cover)return;
   store.put({...book,cover});
   queue(tx,'book:'+id);
  };
  tx.oncomplete=()=>{changed();resolve()};
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error);
 });
}
