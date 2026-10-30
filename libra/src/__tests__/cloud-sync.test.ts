import {expect,it} from 'vitest';
import {runCloudSync,type CloudTransport,type RemoteRecord,type LocalSyncPort} from '../cloudSync';
import {DEFAULT_SETTINGS,type StoredBook} from '../domain';
import type {CloudEntry} from '../storage';
function device(){
 const entries=new Map<string,CloudEntry>(),books=new Map<string,StoredBook>();let settings=DEFAULT_SETTINGS;
 const port:LocalSyncPort={entries:async()=>[...entries.values()],book:async id=>books.get(id),settings:async()=>settings,
 ack:async(e,revision)=>{const current=entries.get(e.key)!;entries.set(e.key,{...current,revision,pending:current.generation!==e.generation})},
 archive:async(_o,id,revision)=>{books.delete(id);entries.set('book:'+id,{id:'u|book:'+id,key:'book:'+id,owner:'u',revision,pending:false,generation:0,deleted:true})},
 apply:async(o,key,revision,book,next,generation)=>{const current=entries.get(key);if(current?.pending&&current.generation!==generation)return false;if(book)books.set(book.id,book);if(next)settings=next;entries.set(key,{id:o+'|'+key,key,owner:o,revision,pending:false,generation:0});return true}};
 return {port,entries,books};
}
function server(){const rows=new Map<string,RemoteRecord>(),files=new Map<string,Blob>();
 const transport:CloudTransport={list:async()=>[...rows.values()],upload:async(path,file)=>{files.set(path,file)},download:async path=>files.get(path)!,
 cas:async(key,expected,payload,deleted)=>{const old=rows.get(key);if(old?.deleted||(old?.revision??0)!==expected)return undefined;const row={key,payload,deleted,revision:expected+1};rows.set(key,row);return row}};
 return {transport,rows,files};
}
it('carries a book, bookmarks and settings to a second device, detects stale edits and preserves tombstones',async()=>{
 const a=device(),b=device(),s=server();
 a.books.set('one',{id:'one',title:'Book',filename:'book.fb2',author:'Author',format:'fb2',file:new Blob(['checked bytes']),importedAt:1,bookmarks:[{chapter:1,page:2,fraction:.2,updatedAt:1}]});
 a.entries.set('book:one',{id:'u|book:one',owner:'u',key:'book:one',revision:0,pending:true,generation:1});
 a.entries.set('settings',{id:'u|settings',owner:'u',key:'settings',revision:0,pending:true,generation:1});
 expect((await runCloudSync('u',s.transport,a.port)).conflicts).toEqual([]);
 await runCloudSync('u',s.transport,b.port);
 expect(await b.books.get('one')!.file.text()).toBe('checked bytes');expect(b.books.get('one')!.bookmarks).toHaveLength(1);
 for(const d of [a,b]){const e=d.entries.get('book:one')!;d.entries.set(e.key,{...e,pending:true,generation:2})}
 a.books.get('one')!.position={chapter:4,page:0,fraction:.5,updatedAt:5};
 await runCloudSync('u',s.transport,a.port);
 const result=await runCloudSync('u',s.transport,b.port);
 expect(result.conflicts.map(c=>c.key)).toEqual(['book:one']);expect(s.rows.get('book:one')!.payload.position).toMatchObject({chapter:4});
 s.rows.set('book:one',{...s.rows.get('book:one')!,revision:3,deleted:true,payload:{}});
 await runCloudSync('u',s.transport,b.port);await runCloudSync('u',s.transport,b.port);
 expect(b.books.has('one')).toBe(false);expect(s.rows.get('book:one')!.deleted).toBe(true);
});
it('rejects corrupt remote bytes before applying a download',async()=>{
 const a=device(),s=server();s.rows.set('book:bad',{key:'book:bad',revision:1,deleted:false,payload:{id:'bad',sha256:'0'.repeat(64),filename:'b.fb2',title:'Bad',author:'A',format:'fb2',importedAt:1,bookmarks:[],size:4,mime:'text/xml'}});s.files.set('u/'+'0'.repeat(64),new Blob(['oops']));
 await expect(runCloudSync('u',s.transport,a.port)).rejects.toThrow(/целостност/);expect(a.books.size).toBe(0);
});
