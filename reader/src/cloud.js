import * as storage from './storage.js';
import {importBook} from './importer.js';
import {mergeMarks,newestState} from './sync-model.js';
import {mergeAnnotations} from './reading-features.js';
import {sha256} from 'js-sha256';
import {supabaseTransport} from './supabase-client.js';
const uuid=()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
export class CloudSync{
 constructor(callbacks){this.cb=callbacks;this.user=null;this.remote=[];this.running=false;this.timer=null;this.retryTimer=null;this.resyncRequested=false;this.status='Проверяем облако…';this.owner=null;this.pending={};this.deviceId=null;}
 async init(){
  try{
   // Device ID must survive a full browser restart. The old session-only ID
   // caused offline edits to become unreachable on the next launch.
   const oldTabId=sessionStorage.getItem('kniga-device');
   let id=await storage.getPreference('kniga-installation-id');
   if(!id){id=oldTabId||uuid();await storage.setPreference('kniga-installation-id',id);}
   this.deviceId=id;
   sessionStorage.setItem('kniga-device',id);
   this.owner=await storage.getPreference('cloud-owner');
   const prefix=`cloud-pending:${this.owner||'guest'}:`;
   this.pending=await storage.getPreference(prefix+id)||{};
   // Recover pending writes created by older versions with temporary tab IDs.
   for(const key of await storage.listPreferenceKeys(prefix)){
    if(key===prefix+id)continue;
    const stale=await storage.getPreference(key)||{};
    for(const [k,record] of Object.entries(stale)){
     if(!this.pending[k]||Number(record.clientUpdatedAt)>Number(this.pending[k].clientUpdatedAt))this.pending[k]=record;
    }
    await storage.deletePreference(key);
   }
   await storage.setPreference(prefix+id,this.pending);
   await this.sync();
  }catch(e){this.setStatus(e.message||'Облако недоступно');}
 }
 setStatus(status){this.status=status;this.cb.status?.(status);}
 async api(url,options={}){if(import.meta.env.MODE==='pages')return supabaseTransport.api(url,options);const r=await fetch(url,{...options,credentials:'same-origin',cache:'no-store'});if(r.status===401){const e=new Error('Войдите через ChatGPT для синхронизации.');e.status=401;throw e;}if(!r.ok){let body;try{body=await r.json();}catch{}const e=new Error(body?.error||'Облако недоступно. Изменения сохранены на устройстве.');e.status=r.status;throw e;}return r;}
 async queue(key,payload,updatedAt=Date.now()){
  this.pending[key]={key,payload,clientUpdatedAt:updatedAt};
  try{await storage.setPreference(`cloud-pending:${this.owner||'guest'}:${this.deviceId}`,this.pending);}catch(e){this.setStatus(e.message);}
  this.setStatus('Изменения ожидают отправки…');
  if(this.running)this.resyncRequested=true;
  clearTimeout(this.timer);this.timer=setTimeout(()=>this.sync(),700);
 }
 async sync(){
  if(this.running){this.resyncRequested=true;return;}
  clearTimeout(this.retryTimer);this.retryTimer=null;
  this.running=true;this.setStatus('Синхронизация…');
  try{
   const response=await this.api('/api/cloud');const snapshot=await response.json();
   if(this.owner&&this.owner!==snapshot.userId){this.pending={};}
   this.owner=snapshot.userId;this.user={id:snapshot.userId,name:snapshot.displayName};await storage.setPreference('cloud-owner',this.owner);
   this.remote=snapshot.states;
   const local=this.cb.books();const remoteIds=new Set(snapshot.books.map(b=>b.id));
   let added=false;
   for(const book of local){
    if(book.id==='sample'||(book.cloudOwner&&book.cloudOwner!==this.owner)||remoteIds.has(book.id))continue;
    await this.api('/api/cloud/book/'+book.id,{method:'PUT',headers:{'Content-Type':'application/octet-stream','x-book-name':encodeURIComponent(book.fileName)},body:book.original});
    book.cloudOwner=this.owner;await storage.putBook(book);
   }
   const hidden=await storage.getPreference(`cloud-hidden:${this.owner}`)||[];
   for(const entry of snapshot.books){
    if(local.some(b=>b.id===entry.id)||hidden.includes(entry.id))continue;
    const response=await this.api('/api/cloud/book/'+entry.id);const original=await response.arrayBuffer();
    const id=sha256(original);
    if(id!==entry.id)throw new Error('Контрольная сумма облачной книги не совпала. Загрузка отменена.');
    const parsed=await importBook(original,entry.fileName);const book={...parsed,id,original,fileName:entry.fileName,cloudOwner:this.owner,addedAt:Date.now(),marks:[]};await storage.putBook(book);this.cb.addBook(book);added=true;
   }
   // Per-tab records isolate simultaneous devices. Upload only explicit local changes.
   for(const [key,record] of Object.entries({...this.pending})){
    let existing=this.remote.find(x=>x.deviceId===this.deviceId&&x.key===key);
    if(key.startsWith('position:'))record.payload={...record.payload,marks:mergeMarks(record.payload.marks||[],...this.remote.filter(x=>x.key===key).map(x=>x.payload?.marks||[])),annotations:mergeAnnotations(record.payload.annotations||[],...this.remote.filter(x=>x.key===key).map(x=>x.payload?.annotations||[]))};
    const headers={'Content-Type':'application/json',...(existing?.etag?{'If-Match':existing.etag}:{})};
    const response=await this.api('/api/cloud/state',{method:'PUT',headers,body:JSON.stringify({...record,deviceId:this.deviceId})});const saved=await response.json();
    const item={...record,deviceId:this.deviceId,etag:saved.etag};this.remote=this.remote.filter(x=>!(x.deviceId===this.deviceId&&x.key===key));this.remote.push(item);
    if(this.pending[key]?.clientUpdatedAt===record.clientUpdatedAt)delete this.pending[key];
   }
   await storage.setPreference(`cloud-pending:${this.owner}:${this.deviceId}`,this.pending);
   const settings=newestState(this.remote,'settings');if(settings)await this.cb.remoteSettings?.(settings);
   for(const b of this.cb.books()){
    const key='position:'+b.id,states=this.remote.filter(x=>x.key===key);if(!states.length)continue;
    const latest=newestState(states,key);const marks=mergeMarks(b.marks||[],...states.map(x=>x.payload?.marks||[]));
    await this.cb.remotePosition(b,latest,marks,mergeAnnotations(b.progress?.annotations||[],...states.map(x=>x.payload?.annotations||[])));
   }
   this.error=null;
   this.setStatus(Object.keys(this.pending).length?'Изменения ожидают отправки…':'Синхронизировано');
   if(added)this.cb.libraryChanged?.();
  }catch(e){
   if(e.status===401){this.user=null;this.remote=[];}
   this.setStatus(e.status===401?'Войти для синхронизации':'Не удалось синхронизировать: '+(e.message||'ошибка подключения'));
   this.error=e;
   if(e.status!==401)this.retryTimer=setTimeout(()=>{this.retryTimer=null;this.sync();},15000);
  }finally{
   this.running=false;
   if(this.resyncRequested){
    this.resyncRequested=false;
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>this.sync(),250);
   }
  }
 }
}
