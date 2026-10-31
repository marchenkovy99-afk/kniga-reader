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

it('retains the exact last page after returning to the library and restarting',async()=>{
 const id='checkpoint-close-and-reopen';
 const book:StoredBook={id,filename:'288.fb2',format:'fb2',title:'288',author:'Reader',
  file:new Blob(['test']),importedAt:3,bookmarks:[]};
 await storage.saveBook(book);
 const older:ReaderPosition={chapter:6,page:12,fraction:.64,updatedAt:400};
 const page288:ReaderPosition={chapter:6,page:14,fraction:.67,updatedAt:401,
  layoutKey:'6:350:640:18',pageCounts:[38,42,49,32,50,62,25]};
 storage.activateReadingSession(id,older);
 await storage.savePosition(id,older);
 const saving=storage.savePosition(id,page288);
 storage.deactivateReadingSession();
 expect(await storage.loadReadingSession()).toBeNull();
 // The background IndexedDB transaction may still be pending on iOS.
 expect(storage.readBookCheckpoint(id)).toEqual(page288);
 expect(storage.freshestPosition(id,older)).toEqual(page288);
 await saving;
 expect((await storage.getBook(id))?.position).toEqual(page288);
 expect(storage.activateReadingSession(id,older)).toEqual(page288);
 expect((await storage.loadReadingSession())?.position).toEqual(page288);
 storage.deactivateReadingSession();
});

it('keeps the latest per-book checkpoint when an earlier page save arrives late',async()=>{
 const id='checkpoint-close-and-reopen';
 storage.activateReadingSession(id,position(20,500));
 await storage.savePosition(id,position(25,510));
 await storage.savePosition(id,position(23,505));
 storage.deactivateReadingSession();
 expect(storage.readBookCheckpoint(id)?.page).toBe(25);
 expect((await storage.getBook(id))?.position?.page).toBe(25);
});

it('returns the newest checkpoint on reactivation so App renders it, not an older IDB copy',async()=>{
 const id='reactivation-authority';
 storage.activateReadingSession(id,position(12,600));
 const last=position(14,605);
 await storage.savePosition(id,last);
 storage.deactivateReadingSession();
 // The caller is holding stale book metadata with the page before the final flip.
 expect(storage.activateReadingSession(id,position(12,600))).toEqual(last);
 expect((await storage.loadReadingSession())?.position).toEqual(last);
 storage.deactivateReadingSession();
});

it('checkpoints an actual page flip after the iOS reading-session flag was cleared',async()=>{
 const id='safari-inactive-reading-session';
 await storage.saveBook({id,filename:'resume.fb2',format:'fb2',title:'Resume',author:'Reader',
  file:new Blob(['test']),importedAt:15,bookmarks:[]});
 const old:ReaderPosition={chapter:0,page:286,globalPage:287,fraction:.7,updatedAt:1000};
 const latest:ReaderPosition={chapter:0,page:288,globalPage:289,fraction:.7,updatedAt:1002};
 storage.activateReadingSession(id,old);
 await storage.savePosition(id,old);
 storage.deactivateReadingSession();
 // WebKit can suspend the session before its final navigation handler commits.
 const lastWrite=storage.savePosition(id,latest);
 expect(storage.readBookCheckpoint(id)).toEqual(latest);
 expect(await storage.loadReadingSession()).toBeNull();
 await lastWrite;
 expect((await storage.getBook(id))?.position).toEqual(latest);
 expect(storage.activateReadingSession(id,old)).toEqual(latest);
 storage.deactivateReadingSession();
});

it('the last explicitly confirmed page survives newer background re-pagination',async()=>{
 const id='reader-confirmed-guard-test';
 await storage.saveBook({id,filename:'guard.fb2',format:'fb2',title:'Guard',
  author:'Reader',file:new Blob(['test']),importedAt:50,bookmarks:[]});
 const page289:ReaderPosition={chapter:2,page:18,globalPage:289,fraction:.73,
  layoutKey:'old-layout',updatedAt:20001,anchor:{block:22,textNode:0,offset:14}};
 const fakeReflow:ReaderPosition={...page289,page:16,globalPage:287,
  updatedAt:20002,layoutKey:'new-layout'};
 storage.activateReadingSession(id,page289);
 await storage.confirmReadingPosition(id,page289);
 await storage.savePosition(id,fakeReflow);
 // A background writer may win IndexedDB, but the explicit guard wins resume.
 expect(storage.readConfirmedPosition(id)).toEqual(page289);
 expect(storage.freshestPosition(id,fakeReflow)).toEqual(page289);
 storage.deactivateReadingSession();
 expect(storage.activateReadingSession(id,fakeReflow)).toEqual(page289);
 expect((await storage.getBook(id))?.position).toEqual(page289);
 storage.deactivateReadingSession();
});

it('only an explicit later reading action can replace the last-page guard',async()=>{
 const id='reader-confirmed-guard-test';
 const first=storage.readConfirmedPosition(id)!;
 const page290={...first,page:19,globalPage:290,updatedAt:first.updatedAt+10};
 await storage.confirmReadingPosition(id,page290);
 expect(storage.readConfirmedPosition(id)).toEqual(page290);
 expect((await storage.getBook(id))?.position).toEqual(page290);
});
