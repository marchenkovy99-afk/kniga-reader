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
 await storage.archiveCloudBook('account-a','deleted',9);
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
