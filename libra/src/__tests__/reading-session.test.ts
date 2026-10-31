import 'fake-indexeddb/auto';
import {expect,it,vi} from 'vitest';
import * as storage from '../storage';
import type {StoredBook,ReaderPosition} from '../domain';

const values=new Map<string,string>();
vi.stubGlobal('localStorage',{
 getItem:(key:string)=>values.get(key)??null,
 setItem:(key:string,value:string)=>{values.set(key,String(value))},
 removeItem:(key:string)=>{values.delete(key)},
});

const position=(page:number,updatedAt:number):ReaderPosition=>({
 chapter:1,page,fraction:page/50,updatedAt,
});

it('reopens the latest page even when an older IndexedDB write completes later',async()=>{
 const book:StoredBook={
  id:'session-checkpoint-book',filename:'test.fb2',format:'fb2',title:'Test',
  author:'Reader',file:new Blob(['test']),importedAt:1,bookmarks:[],
 };
 await storage.saveBook(book);
 storage.activateReadingSession(book.id,position(4,100));
 await storage.savePosition(book.id,position(17,102));
 await storage.savePosition(book.id,position(5,101));
 expect(await storage.loadReadingSession()).toEqual({
  bookId:book.id,position:position(17,102)
 });
 expect((await storage.getBook(book.id))?.position).toMatchObject({chapter:1,page:17});
 storage.deactivateReadingSession();
 expect(await storage.loadReadingSession()).toBeNull();
 // Returning to the library does not erase durable book progress.
 expect((await storage.getBook(book.id))?.position?.page).toBe(17);
});

it('ignores delayed writes from an inactive book and checkpoints the newly opened one',async()=>{
 await storage.saveBook({id:'session-other-book',filename:'other.fb2',format:'fb2',
 title:'Other',author:'Reader',file:new Blob(['other']),importedAt:2,bookmarks:[]});
 storage.activateReadingSession('session-checkpoint-book',position(10,300));
 storage.activateReadingSession('session-other-book',position(7,301));
 await storage.savePosition('session-checkpoint-book',position(20,302));
 expect((await storage.loadReadingSession())?.bookId).toBe('session-other-book');
 storage.deactivateReadingSession();
});
