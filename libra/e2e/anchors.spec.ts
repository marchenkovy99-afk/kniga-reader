import {test,expect} from '@playwright/test';

const paragraphs=Array.from({length:260},(_,i)=>'<p>Фрагмент '+i+'. '+('Непрерывное содержимое предложения. '.repeat(6))+'</p>').join('');
const xml=`<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
<description><title-info><book-title>Книга с якорями</book-title></title-info></description>
<body><section><title><p>Глава</p></title>${paragraphs}</section></body></FictionBook>`;

async function persistedPosition(page:import('@playwright/test').Page){
 return page.evaluate(async()=>{
  const req=indexedDB.open('libra-library');
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  const tx=db.transaction('reading','readonly');
  const query=tx.objectStore('reading').getAll();
  return new Promise<any>((resolve,reject)=>{
   query.onsuccess=()=>resolve(query.result[0]?.position);
   query.onerror=()=>reject(query.error);
  });
 });
}
test('font adjustment and reopen preserve source position and all text',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'anchors.fb2',mimeType:'application/xml',buffer:Buffer.from(xml)});
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toBeVisible();
 for(let i=0;i<5;i++)await page.locator('.reading-zones').click({position:{x:340,y:240}});
 await expect.poll(async()=>((await persistedPosition(page))?.anchor?.block??-1)).toBeGreaterThan(0);
 const original=await persistedPosition(page);
 expect(original.anchor).toBeDefined();
 // Changing font must not reset progress to the beginning.
 await page.locator('.reading-zones').click({position:{x:190,y:240}});
 await page.getByRole('button',{name:'Текст'}).click();
 await page.locator('.sheet-settings input[type=range]').first().fill('23');
 await page.getByRole('button',{name:'Закрыть'}).click();
 await expect.poll(async()=>((await persistedPosition(page))?.anchor?.block??-1)).toBeGreaterThan(0);
 const updated=await persistedPosition(page);
 // The new page's first word may precede the anchor, but cannot jump to chapter start.
 expect(updated.anchor.block).toBeGreaterThan(0);
 expect(updated.anchor.block).toBeGreaterThanOrEqual(original.anchor.block-8);
 await page.reload();
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toBeVisible();
 await expect.poll(async()=>page.locator('.book-flow').evaluate(el=>el.getAttribute('style')||'')).toContain('translateX');
 const after=await page.locator('.book-flow').innerText();
 for(let i=0;i<260;i++)expect(after).toContain('Фрагмент '+i+'.');
});
