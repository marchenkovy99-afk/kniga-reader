import {test,expect} from '@playwright/test';

/**
 * On a clean browser context, create a real V1 database before the React app
 * initializes. The additive V3 upgrade must preserve file bytes, progress and bookmarks
 * while creating an empty cloud outbox.
 */
test('upgrades legacy library to additive v3 cloud storage while preserving book bytes and reading state',async({page})=>{
 await page.goto('/icon.svg');
 const result=await page.evaluate(async()=>{
  const title='<?xml version="1.0"?><FictionBook><description><title-info><book-title>Старая книга</book-title></title-info></description><body><section><p>Сохранённый текст.</p></section></body></FictionBook>';
  const open=indexedDB.open('libra-library',1);
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   open.onupgradeneeded=()=>{
    open.result.createObjectStore('books',{keyPath:'id'});
    open.result.createObjectStore('preferences');
   };
   open.onsuccess=()=>resolve(open.result);
   open.onerror=()=>reject(open.error);
  });
  const tx=db.transaction('books','readwrite');
  tx.objectStore('books').put({
   id:'legacy-book',filename:'old.fb2',title:'Старая книга',
   author:'Автор',format:'fb2',fileBytes:new TextEncoder().encode(title).buffer,
   fileType:'application/xml',importedAt:10,
   bookmarks:[{chapter:0,page:0,fraction:0,updatedAt:20}],
   position:{chapter:0,page:0,fraction:0,updatedAt:21},
   lastOpenedAt:21
  });
  await new Promise<void>((resolve,reject)=>{
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
  });
  db.close();
  return {message:'old database populated',bytes:Array.from(new TextEncoder().encode(title))};
 });
 expect(result.message).toBe('old database populated');
 await page.goto('/');
 await expect(page.locator('.continue-card')).toContainText('Старая книга');
 const after=await page.evaluate(async()=>{
  const request=indexedDB.open('libra-library');
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  const read=async(store:string)=>{
   const tx=db.transaction(store,'readonly'),req=tx.objectStore(store).get('legacy-book');
   return new Promise<any>((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  };
  const books=await read('books'),state=await read('reading');
  const stores=Array.from(db.objectStoreNames);
  const cloudCount=stores.includes('cloud')?await new Promise<number>((resolve,reject)=>{const req=db.transaction('cloud','readonly').objectStore('cloud').count();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)}):undefined;
  const snapshot={version:db.version,stores,cloudCount,bytes:Array.from(new Uint8Array(books.fileBytes)),
   title:books.title,filename:books.filename,position:state?.position,bookmarks:state?.bookmarks,lastOpenedAt:state?.lastOpenedAt};
  db.close();return snapshot;
 });
 expect(after.version).toBe(3);
 expect(after.stores).toEqual(expect.arrayContaining(['books','preferences','reading','cloud']));
 expect(after.cloudCount).toBe(0);
 expect(after.bytes).toEqual(result.bytes);
 expect(after.title).toBe('Старая книга');
 expect(after.filename).toBe('old.fb2');
 expect(after.position).toEqual({chapter:0,page:0,fraction:0,updatedAt:21});
 expect(after.bookmarks).toEqual([{chapter:0,page:0,fraction:0,updatedAt:20}]);
 expect(after.lastOpenedAt).toBe(21);
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('Сохранённый текст.');
});
