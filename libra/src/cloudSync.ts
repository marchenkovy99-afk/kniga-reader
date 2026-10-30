import type {ReaderSettings,StoredBook} from './domain';
import {DEFAULT_SETTINGS} from './domain';
import {normalizeSettings} from './readerSettings';
import * as local from './storage';
import type {CloudEntry} from './storage';
export type RemoteRecord={key:string;revision:number;deleted:boolean;payload:Record<string,unknown>};
export type CloudConflict={key:string;local:CloudEntry;remote:RemoteRecord;title:string};
export type CloudTransport={list:()=>Promise<RemoteRecord[]>;upload:(path:string,file:Blob)=>Promise<void>;download:(path:string)=>Promise<Blob>;cas:(key:string,expected:number,payload:Record<string,unknown>,deleted:boolean)=>Promise<RemoteRecord|undefined>};
export type LocalSyncPort={entries:(owner:string)=>Promise<CloudEntry[]>;book:(id:string)=>Promise<StoredBook|undefined>;settings:()=>Promise<ReaderSettings|undefined>;ack:typeof local.acknowledgeCloudEntry;archive:typeof local.archiveCloudBook;apply:typeof local.applyCloudRecord};
const localPort:LocalSyncPort={entries:local.getCloudEntries,book:local.getBook,settings:local.loadSettings,ack:local.acknowledgeCloudEntry,archive:local.archiveCloudBook,apply:local.applyCloudRecord};
export async function sha256(blob:Blob){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('')}
async function payloadFor(entry:CloudEntry,port:LocalSyncPort){
 if(entry.deleted)return {payload:{},file:undefined} as {payload:Record<string,unknown>;file?:Blob};
 if(entry.key==='settings')return {payload:{settings:await port.settings()??DEFAULT_SETTINGS},file:undefined};
 const book=await port.book(entry.key.slice(5));if(!book)throw Error('Локальный файл книги недоступен');
 if(book.file.size>52428800)throw Error('Для облака книга должна быть не больше 50 МБ');
 const {file,...meta}=book;return {payload:{...meta,sha256:await sha256(file),size:file.size,mime:file.type},file};
}
function validateRow(row:RemoteRecord){if(!(row.key==='settings'||/^book:[A-Za-z0-9_-]{1,128}$/.test(row.key))||!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('Некорректная облачная запись')}
async function pull(owner:string,row:RemoteRecord,transport:CloudTransport,port:LocalSyncPort,generation?:number){
 validateRow(row);
 if(row.deleted){if(row.key.startsWith('book:'))await port.archive(owner,row.key.slice(5),row.revision);return true}
 if(row.key==='settings')return port.apply(owner,row.key,row.revision,undefined,normalizeSettings(row.payload.settings as ReaderSettings),generation);
 const p=row.payload,id=row.key.slice(5);
 if(p.id!==id||!['fb2','epub'].includes(String(p.format))||!(/^[0-9a-f]{64}$/).test(String(p.sha256))||!Number.isSafeInteger(p.size)||Number(p.size)>52428800||Number(p.size)<0||!Array.isArray(p.bookmarks))throw Error('Некорректные данные облачной книги');
 const existing=await port.book(id);
 const file=existing&&existing.file.size===p.size&&await sha256(existing.file)===p.sha256?existing.file:await transport.download(owner+'/'+p.sha256);
 if(file.size!==p.size||await sha256(file)!==p.sha256)throw Error('Проверка целостности облачной книги не пройдена');
 const book:StoredBook={id,filename:String(p.filename??'book.'+p.format),title:String(p.title??'Книга'),author:String(p.author??''),format:p.format as StoredBook['format'],importedAt:Number(p.importedAt)||Date.now(),file,bookmarks:p.bookmarks as StoredBook['bookmarks'],position:p.position as StoredBook['position'],lastOpenedAt:Number(p.lastOpenedAt)||undefined,cover:typeof p.cover==='string'&&p.cover.startsWith('data:image/')?p.cover:undefined};
 return port.apply(owner,row.key,row.revision,book,undefined,generation);
}
async function push(owner:string,entry:CloudEntry,expected:number,transport:CloudTransport,port:LocalSyncPort){
 const {payload,file}=await payloadFor(entry,port);
 if(file)await transport.upload(owner+'/'+payload.sha256,file);
 const result=await transport.cas(entry.key,expected,payload,!!entry.deleted);
 if(result)await port.ack(entry,result.revision);
 return result;
}
/** Server revisions, rather than device clocks, decide whether a write is safe. */
export async function runCloudSync(owner:string,transport:CloudTransport,port:LocalSyncPort=localPort){
 const remote=new Map((await transport.list()).map(row=>{validateRow(row);return [row.key,row]}));
 const entries=await port.entries(owner),byKey=new Map(entries.map(e=>[e.key,e]));
 const conflicts:CloudConflict[]=[];let applied=0;
 for(const row of remote.values()){
  const entry=byKey.get(row.key);
  if(row.deleted){if(!entry?.deleted||entry.revision<row.revision){await pull(owner,row,transport,port);applied++}continue}
  if(entry?.deleted&&!entry.pending)continue;
  if(entry?.pending&&entry.revision!==row.revision){conflicts.push({key:row.key,local:entry,remote:row,title:String(row.payload.title??'Настройки')});continue}
  if(!entry?.pending&&(!entry||row.revision>entry.revision)){if(await pull(owner,row,transport,port))applied++}
 }
 for(const entry of entries){
  const row=remote.get(entry.key);
  if(!entry.pending||row?.deleted||conflicts.some(c=>c.key===entry.key))continue;
  if(!await push(owner,entry,entry.revision,transport,port)){
   const latest=(await transport.list()).find(r=>r.key===entry.key);
   if(latest?.deleted){await pull(owner,latest,transport,port);applied++}
   else if(latest)conflicts.push({key:entry.key,local:entry,remote:latest,title:String(latest.payload.title??'Настройки')});
   else throw Error('Облачная запись изменилась. Повторите синхронизацию');
  }
 }
 return {conflicts,applied};
}
export async function resolveCloudConflict(owner:string,conflict:CloudConflict,choice:'local'|'remote',transport:CloudTransport){
 const entry=(await localPort.entries(owner)).find(e=>e.key===conflict.key);if(!entry)throw Error('Запись изменилась. Повторите синхронизацию');
 if(choice==='remote'){if(!await pull(owner,conflict.remote,transport,localPort,entry.generation))throw Error('Во время выбора книга изменилась. Повторите синхронизацию')}
 else if(!await push(owner,entry,conflict.remote.revision,transport,localPort))throw Error('На другом устройстве появились новые изменения. Повторите синхронизацию');
}
