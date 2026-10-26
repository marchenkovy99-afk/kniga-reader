import * as storage from './storage.js';
import {importBook} from './importer.js';
import {mergeMarks,newestState,pendingForAccount,bookAppearanceKey,latestBookAppearance,latestReadingSettings} from './sync-model.js';
import {mergeAnnotations} from './reading-features.js';
import {sha256} from 'js-sha256';
import {supabaseTransport} from './supabase-client.js';
import {shelfState} from './shelf-state.js';
const uuid=()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
export class CloudSync{
 constructor(callbacks){this.cb=callbacks;this.user=null;this.remote=[];this.running=false;this.paused=false;this.failures=0;this.fullSyncRequested=false;this.timer=null;this.retryTimer=null;this.resyncRequested=false;this.status='Проверяем облако…';this.owner=null;this.pending={};this.deviceId=null;this.details={books:0,states:0,downloaded:0};this.lastSuccessfulAt=null;this.remoteBooksCount=0;}
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
 async api(url,options={}){if(import.meta.env.MODE==='pages')return supabaseTransport.api(url,options);if(url==='/api/cloud/identity')url='/api/cloud';const r=await fetch(url,{...options,credentials:'same-origin',cache:'no-store'});if(r.status===401){const e=new Error('Войдите через ChatGPT для синхронизации.');e.status=401;throw e;}if(!r.ok){let body;try{body=await r.json();}catch{}const e=new Error(body?.error||'Облако недоступно. Изменения сохранены на устройстве.');e.status=r.status;throw e;}return r;}
 pause(){this.paused=true;clearTimeout(this.timer);clearTimeout(this.retryTimer);this.timer=null;this.retryTimer=null;}
 resume(){this.paused=false;}
 canSync(){return !this.paused&&(this.cb.canSync?.()??true);}
 async queue(key,payload,updatedAt=Date.now()){
  const queued=this.pending[key],sent=this.remote.find(r=>r.deviceId===this.deviceId&&r.key===key);
  if(queued&&Number(queued.clientUpdatedAt)>Number(updatedAt))return;
  if(!queued&&sent&&sent.clientUpdatedAt===updatedAt&&JSON.stringify(sent.payload)===JSON.stringify(payload))return;
  this.pending[key]={key,payload,clientUpdatedAt:updatedAt};
  try{await storage.setPreference(`cloud-pending:${this.owner||'guest'}:${this.deviceId}`,this.pending);}catch(e){this.setStatus(e.message);}
  this.setStatus('Изменения ожидают отправки…');
  if(this.running)this.resyncRequested=true;
  clearTimeout(this.timer);if(this.canSync())this.timer=setTimeout(()=>this.sync({uploadOnly:true}),key.startsWith('position:')?5000:1200);
 }
 async sendPending({allowHidden=false}={}){
  const hadPending=Object.keys(this.pending).length>0;
   for(const [key,record] of Object.entries({...this.pending})){
    if(!this.canSync()&&!allowHidden)break;
    let existing=this.remote.find(x=>x.deviceId===this.deviceId&&x.key===key);
    if(key.startsWith('position:'))record.payload={...record.payload,marks:mergeMarks(record.payload.marks||[],...this.remote.filter(x=>x.key===key).map(x=>x.payload?.marks||[])),annotations:mergeAnnotations(record.payload.annotations||[],...this.remote.filter(x=>x.key===key).map(x=>x.payload?.annotations||[]))};
    const headers={'Content-Type':'application/json','x-cloud-owner':this.owner,...(existing?.etag?{'If-Match':existing.etag}:{})};
    const response=await this.api('/api/cloud/state',{method:'PUT',headers,body:JSON.stringify({...record,deviceId:this.deviceId})});const saved=await response.json();
    const item={...record,deviceId:this.deviceId,etag:saved.etag};this.remote=this.remote.filter(x=>!(x.deviceId===this.deviceId&&x.key===key));this.remote.push(item);
    if(this.pending[key]?.clientUpdatedAt===record.clientUpdatedAt)delete this.pending[key];
   }
   if(hadPending)await storage.setPreference(`cloud-pending:${this.owner}:${this.deviceId}`,this.pending);
 }
 async sync({uploadOnly=false,allowHidden=false}={}){
  if(!this.canSync()&&!allowHidden)return;
  if(allowHidden&&(!this.user||!Object.keys(this.pending).length))return;
  if(this.running){this.resyncRequested=true;this.fullSyncRequested||=!uploadOnly;return;}
  clearTimeout(this.timer);this.timer=null;
  clearTimeout(this.retryTimer);this.retryTimer=null;
  this.running=true;this.setStatus('Синхронизация…');
  try{
   if(uploadOnly&&this.user&&this.owner===this.user.id){
    const identity=await (await this.api('/api/cloud/identity')).json();
    if(identity.userId!==this.owner){this.resyncRequested=true;this.fullSyncRequested=true;return;}
    await this.sendPending({allowHidden});this.failures=0;this.error=null;this.lastSuccessfulAt=Date.now();
    this.setStatus(Object.keys(this.pending).length?'Изменения ожидают отправки…':'Синхронизировано');return;
   }
   const response=await this.api('/api/cloud');const snapshot=await response.json();
   // Preserve per-account unsent edits and adopt unauthenticated edits only
   // on the first login. Switching accounts must never clear the other queue.
   if(this.owner!==snapshot.userId){
    if(!this.owner)await shelfState.adoptGuest(snapshot.userId);
    const targetKey=`cloud-pending:${snapshot.userId}:${this.deviceId}`;
    const accountPending=await storage.getPreference(targetKey)||{};
    this.pending=pendingForAccount(this.owner,snapshot.userId,this.pending,accountPending);
    await storage.setPreference(targetKey,this.pending);
   }
   this.owner=snapshot.userId;this.user={id:snapshot.userId,name:snapshot.displayName};await storage.setPreference('cloud-owner',this.owner);
   this.remote=snapshot.states;
   this.details={books:snapshot.books.length,states:snapshot.states.length,downloaded:0};
   const local=this.cb.books();const remoteIds=new Set(snapshot.books.map(b=>b.id));
   let added=false;
   for(const book of local){
    if(!this.canSync()&&!allowHidden)return;
    if(book.id==='sample'||(book.cloudOwner&&book.cloudOwner!==this.owner)||await shelfState.isHidden(book.id,this.owner))continue;
    if(remoteIds.has(book.id)){
     if(book.cloudOwner!==this.owner){book.cloudOwner=this.owner;await shelfState.commit(book,this.owner);}
     continue;
    }
    await this.api('/api/cloud/book/'+book.id,{method:'PUT',headers:{'Content-Type':'application/octet-stream','x-cloud-owner':this.owner,'x-book-name':encodeURIComponent(book.fileName)},body:book.original});
    book.cloudOwner=this.owner;await shelfState.commit(book,this.owner);
   }
   for(const entry of snapshot.books){
    if(!this.canSync()&&!allowHidden)return;
    if(this.cb.books().some(b=>b.id===entry.id)||await shelfState.isHidden(entry.id,this.owner))continue;
    const response=await this.api('/api/cloud/book/'+entry.id);const original=await response.arrayBuffer();
    if(await shelfState.isHidden(entry.id,this.owner))continue;
    const id=sha256(original);
    if(id!==entry.id)throw new Error('Контрольная сумма облачной книги не совпала. Загрузка отменена.');
    const parsed=await importBook(original,entry.fileName);const book={...parsed,id,original,fileName:entry.fileName,cloudOwner:this.owner,addedAt:Date.now(),marks:[]};
    if(await shelfState.commit(book,this.owner,b=>this.cb.addBook(b))){this.details.downloaded++;added=true;}
   }
   await this.sendPending({allowHidden});
   const settings=latestReadingSettings(this.remote);if(settings)await this.cb.remoteSettings?.(settings);
   for(const b of this.cb.books()){
    const key='position:'+b.id,states=this.remote.filter(x=>x.key===key);
    if(states.length){
     const latest=newestState(states,key),marks=mergeMarks(b.marks||[],...states.map(x=>x.payload?.marks||[]));
     await this.cb.remotePosition(b,latest,marks,mergeAnnotations(b.progress?.annotations||[],...states.map(x=>x.payload?.annotations||[])));
    }
    const keyAppearance=bookAppearanceKey(b.id);
    const independent=this.remote.some(x=>x.key===keyAppearance);
    const remoteAppearance=latestBookAppearance(this.remote,b.id);
    if(remoteAppearance)await this.cb.remoteAppearance?.(b,remoteAppearance,Boolean(this.pending[keyAppearance]));
    const localAppearance=this.cb.localAppearance?.(b);
    // Move old reader's appearance out of progress the first time we see it.
    // Only upload a newer local appearance after an independent cloud record exists.
    if(localAppearance?.settings&&Number(localAppearance.updatedAt)>0&&!this.pending[keyAppearance]&&
       (!independent||Number(localAppearance.updatedAt)>Number(remoteAppearance?.clientUpdatedAt||0))){
     await this.queue(keyAppearance,localAppearance.settings,localAppearance.updatedAt);
    }
   }
   this.failures=0;this.error=null;
   this.remoteBooksCount=snapshot.books.length+local.filter(b=>b.id!=='sample'&&b.cloudOwner===this.owner&&!remoteIds.has(b.id)).length;
   this.lastSuccessfulAt=Date.now();
   this.setStatus(Object.keys(this.pending).length?'Изменения ожидают отправки…':'Синхронизировано');
   // A cloud sync result is only successful when all requested book files and
   // per-device state writes returned without errors.
   if(added)this.cb.libraryChanged?.();
  }catch(e){
   if(e.status===401){this.user=null;this.remote=[];}
   this.setStatus(e.status===401?'Войти для синхронизации':'Не удалось синхронизировать: '+(e.message||'ошибка подключения'));
   this.error=e;
   this.failures++;
   if(e.status!==401&&this.canSync())this.retryTimer=setTimeout(()=>{this.retryTimer=null;this.sync();},Math.min(300000,15000*2**Math.min(5,this.failures-1)));
  }finally{
   this.running=false;
   if(this.resyncRequested){
    this.resyncRequested=false;
    clearTimeout(this.timer);
    const full=this.fullSyncRequested;this.fullSyncRequested=false;
    if(!this.error&&this.canSync())this.timer=setTimeout(()=>this.sync({uploadOnly:!full}),250);
   }
   this.cb.onSettled?.();
  }
 }
}
