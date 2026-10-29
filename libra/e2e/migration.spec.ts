import {test,expect} from '@playwright/test';

/**
 * On a clean browser context, create a real V1 database before the React app
 * initializes. The V2 upgrade must preserve file bytes, progress and bookmarks.
 */
test('upgrades legacy local library without losing reading state',async({page})=>{
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
  return 'old database populated';
 });
 expect(result).toBe('old database populated');
 await page.goto('/');
 await expect(page.locator('.continue-card')).toContainText('Старая книга');
 const after=await page.evaluate(async()=>{
  const request=indexedDB.open('libra-library');
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  const read=async(store:string)=>{
   const tx=db.transaction(store,'readonly'),req=tx.objectStore(store).get(store==='books'?'legacy-book':'legacy-book');
   return new Promise<any>((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  };
  const books=await read('books'),state=await read('reading');
  return {version:db.version,bytes:books?.fileBytes?.byteLength||0,
   position:state?.position,bookmarks:state?.bookmarks};
 });
 expect(after.version).toBe(2);
 expect(after.bytes).toBeGreaterThan(100);
 expect(after.position).toMatchObject({chapter:0,page:0});
 expect(after.bookmarks).toHaveLength(1);
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('Сохранённый текст.');
});
