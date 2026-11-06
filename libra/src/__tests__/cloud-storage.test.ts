import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import * as storage from '../storage';
import {DEFAULT_SETTINGS,type StoredBook} from '../domain';
const book=(id:string):StoredBook=>({id,title:id,filename:id+'.fb2',author:'Author',format:'fb2',file:new Blob(['bytes']),importedAt:1,bookmarks:[]});
it('keeps local bytes, scopes books to accounts, and durably queues offline mutations',async()=>{
 await storage.saveBook(book('local'));
 expect((await storage.listBooks()).map(b=>b.id)).toContain('local');
 await storage.setCloudAccount('account-a');
 await storage.attachLocalLibrary('account-a');
 await storage.savePosition('local',{chapter:1,page:2,fraction:.2,updatedAt:12});
 const rows=await storage.getCloudEntries('account-a');
 expect(rows.find(r=>r.key==='book:local')).toMatchObject({owner:'account-a',pending:true});
 await storage.setCloudAccount('account-b');
 expect((await storage.listBooks()).map(b=>b.id)).not.toContain('local');
 expect(await storage.getCloudEntries('account-b')).toEqual([]);
 await storage.setCloudAccount('account-a');
 expect(await (await storage.getBook('local'))!.file.text()).toBe('bytes');
 await storage.deleteBook('local');
 expect((await storage.getCloudEntries('account-a')).find(r=>r.key==='book:local')).toMatchObject({deleted:true,pending:true});
});
it('does not clear a newer offline edit while acknowledging an earlier upload',async()=>{
 await storage.setCloudAccount('account-a');await storage.saveBook(book('race'));await storage.attachLocalLibrary('account-a');
 const old=(await storage.getCloudEntries('account-a')).find(r=>r.key==='book:race')!;
 await storage.savePosition('race',{chapter:2,page:0,fraction:.3,updatedAt:20});
 await storage.acknowledgeCloudEntry(old,7);
 const next=(await storage.getCloudEntries('account-a')).find(r=>r.key==='book:race')!;
 expect(next.pending).toBe(true);expect(next.revision).toBe(7);
});
it('archives remote deletions and cannot reattach them',async()=>{
 await storage.setCloudAccount('account-a');await storage.saveBook(book('deleted'));await storage.attachLocalLibrary('account-a');
 await storage.archiveCloudBook('account-a','deleted',9,(await storage.getCloudEntries('account-a')).find(e=>e.key==='book:deleted')!.generation);
 expect(await storage.getBook('deleted')).toBeUndefined();
 await storage.attachLocalLibrary('account-a');
 expect((await storage.getCloudEntries('account-a')).find(r=>r.key==='book:deleted')).toMatchObject({deleted:true,pending:false,revision:9});
});
it('keeps reader preferences separate when switching accounts',async()=>{
 await storage.setCloudAccount('settings-a');await storage.saveSettings({...DEFAULT_SETTINGS,fontSize:23});await storage.attachLocalLibrary('settings-a');
 await storage.setCloudAccount('settings-b');expect(await storage.loadSettings()).toBeUndefined();await storage.saveSettings({...DEFAULT_SETTINGS,fontSize:16});
 await storage.setCloudAccount('settings-a');expect((await storage.loadSettings())?.fontSize).toBe(23);
});
it('ignores a late reader write after its owning account has changed',async()=>{
 await storage.setCloudAccount('late-a');await storage.saveBook(book('late'));await storage.attachLocalLibrary('late-a');
 await storage.savePosition('late',{chapter:1,page:0,fraction:.1,updatedAt:100});
 await storage.setCloudAccount('late-b');await storage.attachLocalLibrary('late-b');
 await storage.savePosition('late',{chapter:9,page:0,fraction:.9,updatedAt:200});
 expect((await storage.getCloudEntries('late-b')).some(r=>r.key==='book:late')).toBe(false);
 await storage.setCloudAccount('late-a');expect((await storage.getBook('late'))?.position?.chapter).toBe(1);
});
it('preserves account preferences selected before first attach instead of restoring old anonymous preferences',async()=>{
 await storage.setCloudAccount(null);await storage.saveSettings({...DEFAULT_SETTINGS,fontSize:14,theme:'paper'});
 await storage.setCloudAccount('first-attach');await storage.saveSettings({...DEFAULT_SETTINGS,fontSize:25,theme:'oled'});
 await storage.attachLocalLibrary('first-attach');
 expect(await storage.loadSettings()).toMatchObject({fontSize:25,theme:'oled'});
 expect((await storage.getCloudEntries('first-attach')).find(row=>row.key==='settings')).toMatchObject({pending:true});
});

it('never lets a stale remote download roll back an already applied revision',async()=>{
 await storage.setCloudAccount('revision-race');
 const fresh={...book('revision-race'),position:{chapter:4,page:2,fraction:.5,updatedAt:300}};
 await storage.applyCloudRecord('revision-race','book:revision-race',5,fresh);
 const stale={...fresh,position:{chapter:1,page:0,fraction:.1,updatedAt:100}};
 expect(await storage.applyCloudRecord('revision-race','book:revision-race',4,stale)).toBe(false);
 expect((await storage.getBook('revision-race'))?.position?.chapter).toBe(4);
});
it('preserves an edit that arrives before a remote tombstone transaction',async()=>{
 await storage.setCloudAccount('archive-race');await storage.saveBook(book('archive-race'));await storage.attachLocalLibrary('archive-race');
 const sent=(await storage.getCloudEntries('archive-race')).find(e=>e.key==='book:archive-race')!;await storage.acknowledgeCloudEntry(sent,1);
 const snapshot=(await storage.getCloudEntries('archive-race')).find(e=>e.key==='book:archive-race')!;
 await storage.savePosition('archive-race',{chapter:7,page:0,fraction:.7,updatedAt:100});
 expect(await storage.archiveCloudBook('archive-race','archive-race',2)).toBe(false);
 expect(await storage.archiveCloudBook('archive-race','archive-race',2,snapshot.generation)).toBe(false);
 expect((await storage.getBook('archive-race'))?.position?.chapter).toBe(7);
 const current=(await storage.getCloudEntries('archive-race')).find(e=>e.key==='book:archive-race')!;
 expect(await storage.archiveCloudBook('archive-race','archive-race',2,current.generation)).toBe(true);
});
it('ignores a late upload acknowledgment after a newer revision has already been applied',async()=>{
 await storage.setCloudAccount('ack-race');await storage.saveBook(book('ack-race'));await storage.attachLocalLibrary('ack-race');
 const sent=(await storage.getCloudEntries('ack-race')).find(e=>e.key==='book:ack-race')!;
 await storage.acknowledgeCloudEntry(sent,5);await storage.acknowledgeCloudEntry(sent,2);
 expect((await storage.getCloudEntries('ack-race')).find(e=>e.key==='book:ack-race')?.revision).toBe(5);
});
it('never adopts or deletes another account book through delayed library mutations',async()=>{
 await storage.setCloudAccount('mutations-a');await storage.saveBook(book('private-mutations'));await storage.attachLocalLibrary('mutations-a');
 await storage.setCloudAccount('mutations-b');await storage.attachLocalLibrary('mutations-b');
 expect(await storage.getBook('private-mutations')).toBeUndefined();
 await expect(storage.setBookFavorite('private-mutations',true)).rejects.toThrow();
 expect(await storage.getBook('private-mutations')).toBeUndefined();
 await expect(storage.updateBookCover('private-mutations','data:image/png;base64,aGVsbG8=')).rejects.toThrow();
 expect(await storage.getBook('private-mutations')).toBeUndefined();
 await expect(storage.saveBook({...book('private-mutations'),title:'must not overwrite'})).rejects.toThrow();
 expect(await storage.getBook('private-mutations')).toBeUndefined();
 await expect(storage.deleteBook('private-mutations')).rejects.toThrow();
 expect((await storage.getCloudEntries('mutations-b')).some(e=>e.key==='book:private-mutations')).toBe(false);
 await storage.setCloudAccount('mutations-a');
 expect((await storage.getBook('private-mutations'))?.title).toBe('private-mutations');
 expect(await (await storage.getBook('private-mutations'))!.file.text()).toBe('bytes');
});

it('fences a new import when its owner changes while the original bytes are being read',async()=>{
 await storage.setCloudAccount('slow-import-a');await storage.attachLocalLibrary('slow-import-a');
 const file=new Blob(['private import']);let resume!:(v:ArrayBuffer)=>void;
 file.arrayBuffer=()=>new Promise(resolve=>{resume=resolve});
 const pending=storage.saveBook({...book('slow-import'),file});
 await storage.setCloudAccount('slow-import-b');await storage.attachLocalLibrary('slow-import-b');
 resume(new TextEncoder().encode('private import').buffer);
 await expect(pending).rejects.toThrow();
 expect(await storage.getBook('slow-import')).toBeUndefined();
});
for(const operation of ['favorite','cover'] as const)it('aborts '+operation+' if the account changes between authorization and the final book read',async()=>{
 const id='callback-'+operation;
 await storage.setCloudAccount('callback-a');await storage.saveBook(book(id));await storage.attachLocalLibrary('callback-a');
 const original=IDBObjectStore.prototype.get;let intercepted=false;
 IDBObjectStore.prototype.get=function(key){
  const req=original.call(this,key);
  if(this.name==='books'&&key===id&&!intercepted){
   intercepted=true;let handler:((event:Event)=>unknown)|null=null;const tx=this.transaction;
   Object.defineProperty(req,'onsuccess',{configurable:true,get:()=>handler,set:value=>{handler=value}});
   req.addEventListener('success',event=>{
    let switched=false;void storage.setCloudAccount('callback-b').then(()=>{switched=true});
    const keepActive=()=>{const pin=tx.objectStore('cloud').getAll();pin.onsuccess=()=>{if(switched)handler?.call(req,event);else keepActive()}};
    keepActive();
   });
  }
  return req;
 };
 try{
  await expect(operation==='favorite'?storage.setBookFavorite(id,true):storage.updateBookCover(id,'data:image/png;base64,aGVsbG8=')).rejects.toThrow();
 }finally{IDBObjectStore.prototype.get=original}
 expect(intercepted).toBe(true);expect(await storage.getBook(id)).toBeUndefined();
 expect((await storage.getCloudEntries('callback-b')).some(row=>row.key==='book:'+id)).toBe(false);
 await storage.setCloudAccount('callback-a');expect((await storage.getBook(id))?.isFavorite).not.toBe(true);expect((await storage.getBook(id))?.cover).toBeUndefined();
});
