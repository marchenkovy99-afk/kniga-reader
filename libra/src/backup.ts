import type {ReaderPosition,ReaderSettings,StoredBook,Format} from './domain';
import {normalizeSettings} from './readerSettings';

const FORMAT='LIBRA_BACKUP' as const;
export const MAX_BACKUP_SOURCE_BYTES=96*1024*1024;
export const MAX_BACKUP_JSON_BYTES=150*1024*1024;

export type BackupBook={
 id:string;filename:string;title:string;author:string;format:Format;importedAt:number;
 cover?:string;position?:ReaderPosition;lastOpenedAt?:number;bookmarks:ReaderPosition[];
 mediaType:string;bytesBase64:string;sha256:string
};
export type BackupFile={
 format:typeof FORMAT;version:1;createdAt:string;settings:ReaderSettings;books:BackupBook[]
};
export type RestoredArchive={settings:ReaderSettings;books:StoredBook[]};

const base64Characters=/^[A-Za-z0-9+/]*={0,2}$/;
function decodeBase64(value:string):Uint8Array{
 if(value.length%4!==0||!base64Characters.test(value))throw Error('Повреждённое содержимое книги в архиве');
 const binary=atob(value);
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}
async function sha256(buffer:ArrayBuffer):Promise<string>{
 if(!crypto.subtle)throw Error('Для проверки архива требуется безопасное соединение HTTPS');
 const digest=await crypto.subtle.digest('SHA-256',buffer);
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
const requiredString=(v:unknown,name:string,max=1000):string=>{
 if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Недопустимое поле архива: '+name);
 return v;
};
const natural=(v:unknown,name:string):number=>{
 if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw Error('Недопустимое значение: '+name);
 return v;
};
function position(value:unknown):ReaderPosition|undefined{
 if(value===undefined||value===null)return undefined;
 if(!value||typeof value!=='object')throw Error('Недопустимая позиция чтения');
 const p=value as ReaderPosition;
 natural(p.chapter,'chapter');natural(p.page,'page');
 if(typeof p.fraction!=='number'||!Number.isFinite(p.fraction)||p.fraction<0||p.fraction>1)throw Error('Недопустимый прогресс книги');
 if(p.cfi!==undefined&&(typeof p.cfi!=='string'||p.cfi.length>4096))throw Error('Недопустимый EPUB CFI');
 if(p.anchor!==undefined){
  natural(p.anchor?.block,'anchor block');
  if(!Number.isSafeInteger(p.anchor?.textNode)||p.anchor.textNode< -1)throw Error('Недопустимый текстовый якорь');
  natural(p.anchor?.offset,'anchor offset');
 }
 natural(p.updatedAt,'updatedAt');
 return {chapter:p.chapter,page:p.page,fraction:p.fraction,cfi:p.cfi,anchor:p.anchor,updatedAt:p.updatedAt};
}
/** Entire snapshot includes original binary books, positions, bookmarks and settings. */
export async function createBackup(books:StoredBook[],settings:ReaderSettings):Promise<Blob>{
 const total=books.reduce((s,b)=>s+b.file.size,0);
 if(total>MAX_BACKUP_SOURCE_BYTES)throw Error('Объём книг превышает 96 МБ. Уменьшите размер библиотеки для резервной копии.');
 const archived:BackupBook[]=[];
 for(const book of books){
  const buffer=await book.file.arrayBuffer();
  // Important: chunks aligned to three bytes; no embedded padding.
  const source=new Uint8Array(buffer);
  const parts:string[]=[];
  for(let i=0;i<source.length;i+=16_383){
   let chars='';
   for(const byte of source.subarray(i,i+16_383))chars+=String.fromCharCode(byte);
   parts.push(btoa(chars));
  }
  archived.push({id:book.id,filename:book.filename,title:book.title,author:book.author,
   format:book.format,importedAt:book.importedAt,cover:book.cover,position:book.position,
   lastOpenedAt:book.lastOpenedAt,bookmarks:book.bookmarks||[],
   mediaType:book.file.type,bytesBase64:parts.join(''),sha256:await sha256(buffer)});
 }
 const data:BackupFile={format:FORMAT,version:1,createdAt:new Date().toISOString(),
  settings:normalizeSettings(settings),books:archived};
 const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
 if(blob.size>MAX_BACKUP_JSON_BYTES)throw Error('Резервная копия превышает безопасный размер для браузера.');
 return blob;
}
/**
 * Preflight every book and every hash before any IndexedDB writes.
 * Reject malformed or future-version archives without mutating local data.
 */
export async function parseBackup(file:Blob):Promise<RestoredArchive>{
 if(file.size>MAX_BACKUP_JSON_BYTES)throw Error('Архив превышает допустимые 150 МБ');
 let root:unknown;
 try{root=JSON.parse(await file.text())}catch{throw Error('Файл не является корректным архивом LIBRA')}
 if(!root||typeof root!=='object')throw Error('Неверный формат архива LIBRA');
 const data=root as Partial<BackupFile>;
 if(data.format!==FORMAT||data.version!==1||!Array.isArray(data.books))
  throw Error('Неподдерживаемая версия архива LIBRA');
 if(!data.settings||typeof data.settings!=='object')throw Error('В архиве отсутствуют настройки');
 if(data.books.length>2000)throw Error('Слишком много книг в архиве');
 const restored:StoredBook[]=[],ids=new Set<string>();
 let total=0;
 for(const b of data.books){
  if(!b||typeof b!=='object')throw Error('Повреждена запись книги');
  const id=requiredString(b.id,'id',128);
  if(ids.has(id))throw Error('Повторяющийся ID книги в архиве');
  ids.add(id);
  const filename=requiredString(b.filename,'filename',1024);
  const title=requiredString(b.title,'title',1024);
  const author=requiredString(b.author,'author',1024);
  if(!['fb2','epub','pdf'].includes(b.format))throw Error('Неизвестный формат книги');
  const format=b.format;
  const importedAt=natural(b.importedAt,'importedAt');
  const lastOpenedAt=b.lastOpenedAt===undefined?undefined:natural(b.lastOpenedAt,'lastOpenedAt');
  if(typeof b.bytesBase64!=='string'||b.bytesBase64.length>MAX_BACKUP_JSON_BYTES)
   throw Error('Нет файла книги: '+title);
  if(typeof b.sha256!=='string'||!/^[0-9a-f]{64}$/.test(b.sha256))
   throw Error('Отсутствует контрольная сумма: '+title);
  if(b.cover!==undefined&&(typeof b.cover!=='string'||b.cover.length>5_000_000))
   throw Error('Некорректная обложка: '+title);
  if(b.mediaType!==undefined&&typeof b.mediaType!=='string')throw Error('Неверный MIME-тип');
  if(!Array.isArray(b.bookmarks)||b.bookmarks.length>10000)throw Error('Некорректные закладки');
  const bytes=decodeBase64(b.bytesBase64);
  total+=bytes.length;
  if(total>MAX_BACKUP_SOURCE_BYTES)throw Error('Архив содержит слишком много данных');
  const verifiedBuffer=Uint8Array.from(bytes).buffer;
  if(await sha256(verifiedBuffer)!==b.sha256)throw Error('Проверка целостности не пройдена: '+title);
  restored.push({id,filename,title,author,format,importedAt,lastOpenedAt,cover:b.cover,
   position:position(b.position),bookmarks:b.bookmarks.map(p=>{
    const checked=position(p);if(!checked)throw Error('Некорректная закладка');return checked;
   }),file:new Blob([verifiedBuffer],{type:b.mediaType||'application/octet-stream'})});
 }
 return {books:restored,settings:normalizeSettings(data.settings)};
}
