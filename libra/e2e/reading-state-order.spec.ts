import {test,expect} from '@playwright/test';
const source='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Порядок записей</book-title></title-info></description>'+
 '<body><section>'+Array.from({length:40},(_,i)=>'<p>Параграф '+i+
 '. '+'Проверяем восстановление страниц после быстрых изменений. '.repeat(6)+'</p>').join('')+
 '</section></body></FictionBook>';

test('outdated async reading-state write cannot rewind position, bookmarks survive',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'monotonic.fb2',mimeType:'application/xml',buffer:Buffer.from(source)
 });
 await expect(page.locator('.continue-card')).toBeVisible();
 const audit=await page.evaluate(async()=>{
  const m=await import('/src/storage.ts');
  const book=(await m.listBooks())[0];
  const now=Date.now()+100000;
  const recent={chapter:0,page:13,fraction:.6,updatedAt:now};
  const stale={chapter:0,page:2,fraction:.1,updatedAt:now-2000};
  await m.savePosition(book.id,recent);
  await m.toggleBookmark(book.id,{...recent,page:4,fraction:.2});
  await m.savePosition(book.id,stale);
  const after=await m.getBook(book.id);
  await m.savePosition(book.id,{...recent,page:7,fraction:.3,updatedAt:now+1});
  const newer=await m.getBook(book.id);
  return {
   keptPage:after?.position?.page,bookmarks:after?.bookmarks.length,
   newPage:newer?.position?.page
  };
 });
 expect(audit).toEqual({keptPage:13,bookmarks:1,newPage:7});
 await page.reload();
 const persisted=await page.evaluate(async()=>{
  const m=await import('/src/storage.ts');
  const book=(await m.listBooks())[0];
  return {page:book.position?.page,marks:book.bookmarks.length};
 });
 expect(persisted).toEqual({page:7,marks:1});
});
