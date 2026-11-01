import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import * as storage from '../storage';
import type {StoredBook} from '../domain';

it('saves and removes a quote without losing the book, its reading position or bookmarks', async()=>{
 const position={chapter:1,page:3,fraction:0.25,updatedAt:123};
 const book:StoredBook={id:'quote-test',title:'Тест',filename:'test.fb2',author:'',format:'fb2',file:new Blob(['original']),importedAt:1,bookmarks:[]};
 await storage.setCloudAccount(null);
 await storage.saveBook(book);
 await storage.savePosition(book.id,position);
 await storage.toggleBookmark(book.id,position);
 const quote={id:'q1',text:'Любимая цитата',position,createdAt:124};
 await storage.addQuote(book.id,quote);
 const saved=await storage.getBook(book.id);
 expect(saved?.quotes).toEqual([quote]);
 expect(saved?.position).toEqual(position);
 expect(saved?.bookmarks).toEqual([position]);
 expect(await saved?.file.text()).toBe('original');
 await storage.removeQuote(book.id,quote.id);
 expect((await storage.getBook(book.id))?.quotes).toEqual([]);
});

it('preserves quote text and location through a backup and restore', async()=>{
 const {createBackup,parseBackup}=await import('../backup');
 const {DEFAULT_SETTINGS}=await import('../domain');
 const position={chapter:1,page:3,fraction:0.25,anchor:{block:2,textNode:0,offset:5},updatedAt:123};
 const quote={id:'q-backup',text:'Важные слова',position,createdAt:124};
 const book:StoredBook={id:'backup-quote',title:'Тест',filename:'test.fb2',author:'Автор',format:'fb2',file:new Blob(['book bytes']),importedAt:1,bookmarks:[],quotes:[quote]};
 const restored=await parseBackup(await createBackup([book],DEFAULT_SETTINGS));
 expect(restored.books[0].quotes).toEqual([quote]);
 expect(await restored.books[0].file.text()).toBe('book bytes');
});
