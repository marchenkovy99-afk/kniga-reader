import {test,expect} from '@playwright/test';

const fixture='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Точная страница</book-title></title-info></description>'+
 '<body>'+[36,18,8].map((n,c)=>'<section><title><p>Глава '+(c+1)+'</p></title>'+
 Array.from({length:n},(_,i)=>'<p>Абзац '+c+'-'+i+'. '+
 'Читатель должен вернуться к той же самой странице после полного перезапуска. '.repeat(7)+
 '</p>').join('')+'</section>').join('')+'</body></FictionBook>';

test('iPhone: reopen exact book-wide page after app restart and return to library',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'resume.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await page.locator('.continue-card').click();
 const status=page.getByRole('button',{name:'Показать управление чтением'});
 await expect(status).toBeVisible();
 await status.click();
 const slider=page.getByRole('slider',{name:'Прогресс чтения'});
 await expect(slider).toBeEnabled({timeout:60000});
 const caption=await page.locator('.reading-progress span').innerText();
 const total=Number(/из (\\d+)/.exec(caption)?.[1]);
 expect(total).toBeGreaterThan(16);
 const target=Math.min(20,total-3);
 await page.getByRole('button',{name:'Страница',exact:true}).click();
 await page.getByRole('spinbutton').fill(String(target));
 await page.getByRole('button',{name:'Перейти',exact:true}).click();
 await expect(status).toContainText(target+' / '+total);
 const before=await page.evaluate(async()=>{
  const storage=await import('/src/storage.ts');
  const book=(await storage.listBooks())[0];
  return book.position;
 });
 expect(before?.globalPage).toBe(target);
 const bookChapter=before!.chapter,chapterPage=before!.page;
 // Fully closing and reopening the standalone browser window is represented
 // by a hard page reload with IndexedDB and localStorage retained.
 await page.reload();
 await expect(status).toBeVisible({timeout:60000});
 await expect(status).toContainText(target+' /', {timeout:60000});
 const after=await page.evaluate(async()=>{
  const storage=await import('/src/storage.ts');
  const book=(await storage.listBooks())[0];
  return book.position;
 });
 expect(after?.globalPage).toBe(target);
 expect(after?.chapter).toBe(bookChapter);
 expect(after?.page).toBe(chapterPage);
 // Also verify the explicit library/back path, which clears the active
 // session but must retain the per-book checkpoint.
 await page.locator('.reading-zones').click({position:{x:170,y:220}});
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await page.locator('.continue-card').click();
 await expect(status).toContainText(target+' /', {timeout:60000});
});
