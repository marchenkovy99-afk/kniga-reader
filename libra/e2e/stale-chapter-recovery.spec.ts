import {test,expect} from '@playwright/test';

const fixture='<?xml version="1.0" encoding="UTF-8"?>'+
 '<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Восстановление главы</book-title></title-info></description>'+
 '<body><section><title><p>Первый раздел</p></title><p>Начальный текст сохранён.</p></section>'+
 '<section><title><p>Второй раздел</p></title><p>Заключительный текст сохранён.</p></section></body></FictionBook>';

test('an invalid saved chapter opens real content and preserves original bytes and bookmarks',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'stale-chapter.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await expect(page.locator('.continue-card')).toBeVisible();
 const initial=await page.evaluate(async()=>{
  const storage=await import('/src/storage.ts');
  const book=(await storage.listBooks())[0];
  const updatedAt=Date.now()-10000;
  await storage.savePosition(book.id,{chapter:999,page:88,fraction:1,updatedAt});
  await storage.toggleBookmark(book.id,{chapter:1,page:0,fraction:1,updatedAt});
  return {id:book.id,size:book.file.size};
 });
 await page.reload();
 await page.locator('.continue-card').click();
 const flow=page.locator('.page-viewport > .book-flow');
 await expect(flow).toContainText('Начальный текст сохранён.');
 await expect(page.locator('.reading-progress strong')).toHaveText('50%');
 const restored=await page.evaluate(async()=>{
  const storage=await import('/src/storage.ts');
  const book=(await storage.listBooks())[0];
  return {size:book.file.size,chapter:book.position?.chapter,marks:book.bookmarks.length};
 });
 expect(restored).toEqual({size:initial.size,chapter:0,marks:1});
 const viewport=page.viewportSize()!;
 await page.mouse.click(viewport.width*.9,viewport.height*.5);
 await expect(flow).toContainText('Заключительный текст сохранён.');
 await expect(page.locator('.reading-progress strong')).toHaveText('100%');
});