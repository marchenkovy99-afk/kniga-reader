import {test,expect} from '@playwright/test';

const paragraphs=Array.from({length:260},(_,i)=>'<p>Фрагмент '+i+'. '+('Непрерывное содержимое предложения. '.repeat(6))+'</p>').join('');
const xml=`<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
<description><title-info><book-title>Книга с якорями</book-title></title-info></description>
<body><section><title><p>Глава</p></title>${paragraphs}</section></body></FictionBook>`;

test('font adjustment and reload preserve an FB2 text anchor',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'anchors.fb2',mimeType:'application/xml',buffer:Buffer.from(xml)});
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toBeVisible();
 // Navigate several pages to establish a nonzero source anchor.
 for(let i=0;i<4;i++){
  await page.locator('.reading-zones').click({position:{x:340,y:240}});
 }
 // The write is deliberately debounced; wait until the anchor reaches storage.
 await expect.poll(async()=>page.evaluate(async()=>{
   const request=indexedDB.open('libra-library',1);
   const db=await new Promise<IDBDatabase>((resolve)=>{request.onsuccess=()=>resolve(request.result)});
   const query=db.transaction('books').objectStore('books').getAll();
   return new Promise<number>((resolve)=>{query.onsuccess=()=>resolve(query.result[0]?.position?.anchor?.block??-1)});
 })).toBeGreaterThan(0);
 const original=await page.evaluate(async()=>{
  const request=indexedDB.open('libra-library',1);
  const db=await new Promise<IDBDatabase>(resolve=>{request.onsuccess=()=>resolve(request.result)});
  const q=db.transaction('books').objectStore('books').getAll();
  return new Promise<any>(resolve=>{q.onsuccess=()=>resolve(q.result[0]?.position?.anchor)});
 });
 // Toggle controls, enlarge font, close sheet. Position must be restored by anchor.
 await page.locator('.reading-zones').click({position:{x:190,y:240}});
 await page.getByRole('button',{name:'Текст'}).click();
 await page.locator('.sheet-settings input[type=range]').first().fill('23');
 await page.getByRole('button',{name:'Закрыть'}).click();
 await expect(page.locator('.book-flow')).toBeVisible();
 await page.waitForTimeout(450);
 const updated=await page.evaluate(async()=>{
  const request=indexedDB.open('libra-library',1);
  const db=await new Promise<IDBDatabase>(resolve=>{request.onsuccess=()=>resolve(request.result)});
  const q=db.transaction('books').objectStore('books').getAll();
  return new Promise<any>(resolve=>{q.onsuccess=()=>resolve(q.result[0]?.position?.anchor)});
 });
 expect(updated?.block).toBeGreaterThanOrEqual(original.block-2);
 await page.reload();
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toBeVisible();
 await expect.poll(async()=>page.locator('.book-flow').evaluate(el=>el.getAttribute('style')||'')).toContain('translate3d');
 const after=await page.locator('.book-flow').innerText();
 for(let i=0;i<260;i++)expect(after).toContain('Фрагмент '+i+'.');
});
