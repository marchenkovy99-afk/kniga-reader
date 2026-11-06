import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {indexedDB,IDBObjectStore} from 'fake-indexeddb';
const bundle=await readFile(new URL('output/src/assets/index-DMkgLOVA.js',import.meta.url),'utf8');
function extract(name,next){const start=bundle.indexOf('async function '+name+'(');assert.ok(start>=0);const end=bundle.indexOf('async function '+next+'(',start+1);assert.ok(end>start);return bundle.slice(start,end)}
const source=extract('Da','Na');
function fixture(){
 const bytes=new Blob(['original']),entry={id:'u|book:test',key:'book:test',owner:'u',revision:1,pending:true,generation:2};let archived=false;
 const book={id:'test',format:'fb2',file:bytes,bookmarks:[]};
 const port={entries:async()=>[entry],book:async()=>book,archive:async()=>{archived=true},apply:async()=>true,ack:async()=>{}};
 const transport={list:async()=>[{key:entry.key,revision:2,deleted:true,payload:{}}],upload:async()=>{},download:async()=>bytes,cas:async()=>undefined};
 const context={crypto,Blob,Error,Map,Number,Array,String,Date,Ea:port,We:x=>x};
 vm.runInNewContext(source+';globalThis.sync=Ma;globalThis.pull=Aa;',context);
 return {context,port,transport,entry,book,get archived(){return archived}};
}
test('recovered release presents a conflict instead of archiving pending offline edits',async()=>{
 const f=fixture(),result=await f.context.sync('u',f.transport,f.port);
 assert.equal(result.conflicts.length,1);assert.equal(f.archived,false);
});
test('recovered release refuses replacement bytes for an existing book id',async()=>{
 const f=fixture(),other=new Blob(['replacement']),hash=Buffer.from(await crypto.subtle.digest('SHA-256',await other.arrayBuffer())).toString('hex');
 const row={key:'book:test',revision:2,deleted:false,payload:{id:'test',format:'fb2',bookmarks:[],size:other.size,sha256:hash}};
 f.transport.download=async()=>other;
 await assert.rejects(f.context.pull('u',row,f.transport,f.port),/файл/);
});
test('recovered release cannot roll back a locally applied revision',async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('release-revision',1);r.onupgradeneeded=()=>{for(const name of ['books','reading','cloud'])r.result.createObjectStore(name,{keyPath:'id'});r.result.createObjectStore('preferences')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 await new Promise((resolve,reject)=>{const tx=db.transaction('cloud','readwrite');tx.objectStore('cloud').put({id:'u|book:test',owner:'u',key:'book:test',revision:5,pending:false,generation:1});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
 const context={T:'u',A:async()=>db,he:async()=>[],Error,Promise};
 vm.runInNewContext(extract('L','R')+';globalThis.apply=L;',context);
 assert.equal(await context.apply('u','book:test',4),false);db.close();
});
async function cloudDatabase(name,row){
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('cloud',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 await new Promise(resolve=>{const tx=db.transaction('cloud','readwrite');tx.objectStore('cloud').put(row);tx.oncomplete=resolve});return db;
}
const getCloudRow=db=>new Promise(resolve=>{const r=db.transaction('cloud').objectStore('cloud').get('u|book:test');r.onsuccess=()=>resolve(r.result)});
test('recovered release archive transaction checks pending generation and account',async()=>{
 const row={id:'u|book:test',key:'book:test',owner:'u',revision:1,pending:true,generation:2};
 const db=await cloudDatabase('archive-review',row),context={T:'u',A:async()=>db,k:()=>{},Error,Promise};
 vm.runInNewContext(extract('I','L')+';globalThis.archive=I;',context);
 assert.equal(await context.archive('u','test',2,1),false);assert.deepEqual(await getCloudRow(db),row);
 assert.equal(await context.archive('other-account','test',2,2),false);
 assert.equal(await context.archive('u','test',2,2),true);db.close();
});
test('recovered release ignores a late acknowledgment of an older server revision',async()=>{
 const row={id:'u|book:test',key:'book:test',owner:'u',revision:5,pending:false,generation:2};
 const db=await cloudDatabase('ack-review',row),context={A:async()=>db,Promise};
 vm.runInNewContext(extract('ye','I')+';globalThis.ack=ye;',context);
 await context.ack({...row,revision:1},2);assert.equal((await getCloudRow(db)).revision,5);db.close();
});
async function mutationFixture(name){
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('mutations-'+name,1);r.onupgradeneeded=()=>{for(const n of ['books','reading','cloud'])r.result.createObjectStore(n,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 await new Promise(resolve=>{const tx=db.transaction(['books','cloud'],'readwrite');tx.objectStore('books').put({id:'private',title:'PRIVATE A BOOK',fileBytes:new TextEncoder().encode('PRIVATE BYTES').buffer,fileType:'text/xml'});tx.objectStore('cloud').put({id:'a|book:private',owner:'a',key:'book:private',revision:1,pending:false,generation:1});tx.oncomplete=resolve});
 const context={T:'b',A:async()=>db,k:()=>{},Blob,Promise,Error,te:(tx,key)=>tx.objectStore('cloud').put({id:'b|'+key,owner:'b',key,revision:0,pending:true,generation:1})};
 const guardStart=bundle.indexOf('function libraGuardBookWrite('),guardEnd=bundle.indexOf('async function j(',guardStart);
 const guard=guardStart>=0?bundle.slice(guardStart,guardEnd):'';
 vm.runInNewContext(guard+extract('j','N')+extract('R','be')+extract('be','xe')+';globalThis.mutations={favorite:R,cover:be,save:j,remove:M};',context);
 return {db,context};
}
for(const op of ['favorite','cover','save','remove'])test('recovered '+op+' cannot expose or overwrite another account book',async()=>{
 const {db,context}=await mutationFixture(op),f=context.mutations[op];
 const action=op==='save'?()=>f({id:'private',title:'overwritten',file:new Blob(['new bytes']),bookmarks:[]}):()=>f('private',op==='cover'?'data:image/png;base64,aGVsbG8=':true);
 await assert.rejects(action());
 const rows=await new Promise(resolve=>{const r=db.transaction('cloud').objectStore('cloud').getAll();r.onsuccess=()=>resolve(r.result)});assert.equal(rows.some(r=>r.owner==='b'),false);
 const record=await new Promise(resolve=>{const r=db.transaction('books').objectStore('books').get('private');r.onsuccess=()=>resolve(r.result)});assert.equal(record.title,'PRIVATE A BOOK');assert.equal(new TextDecoder().decode(record.fileBytes),'PRIVATE BYTES');db.close();
});

for(const op of ['favorite','cover'])test('recovered '+op+' rechecks the owner in the final asynchronous callback',async()=>{
 const {db,context}=await mutationFixture('callback-'+op);context.T='a';
 const original=IDBObjectStore.prototype.get;let changed=false;
 IDBObjectStore.prototype.get=function(key){
  const req=original.call(this,key);
  if(this.name==='books'&&key==='private'){
   let handler;Object.defineProperty(req,'onsuccess',{configurable:true,get:()=>handler,set:value=>{handler=value}});
   req.addEventListener('success',event=>{changed=true;context.T='b';handler.call(req,event)});
  }
  return req;
 };
 try{await assert.rejects(()=>context.mutations[op]('private',op==='cover'?'data:image/png;base64,aGVsbG8=':true));assert.equal(changed,true)}finally{IDBObjectStore.prototype.get=original;db.close()}
});
