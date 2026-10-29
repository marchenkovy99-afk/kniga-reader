import { test,expect } from '@playwright/test';

const paragraphs=Array.from({length:140},(_,index)=>
 '<p>Позиция '+index+'. '+('Текст для проверки восстановления закладок. '.repeat(5))+'</p>').join('');
const fixture='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Проверка закладок</book-title></title-info></description>'+
 '<body><section><title><p>Глава первая</p></title>'+paragraphs+'</section></body></FictionBook>';

test('saved bookmark has the correct state and reopens its own page',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'bookmarks.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toBeVisible();
 await expect.poll(()=>page.locator('.book-flow').evaluate(
   node=>node.scrollWidth/(node.clientWidth||1))).toBeGreaterThan(6);
 // Advance several pages before saving a bookmark.
 for(let i=0;i<4;i++)await page.locator('.reading-zones').click({position:{x:340,y:220}});
 const original=await page.locator('.book-flow').evaluate(el=>getComputedStyle(el).transform);
 await page.locator('.reading-zones').click({position:{x:190,y:220}});
 const bookmark=page.getByRole('button',{name:'Закладка'});
 await expect(bookmark).toBeVisible();
 await expect(bookmark).toHaveAttribute('aria-pressed','false');
 await bookmark.click();
 await expect(bookmark).toHaveAttribute('aria-pressed','true');
 // On the following page, the indicator must reflect that it is not marked.
 await page.locator('.reading-zones').click({position:{x:340,y:220}});
 await expect(bookmark).toHaveAttribute('aria-pressed','false');
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await page.getByRole('button',{name:'Закладки'}).click();
 const saved=page.locator('.bookmark-item');
 await expect(saved).toHaveCount(1);
 await expect(saved).toContainText('Глава 1');
 await saved.click();
 await expect(page.locator('.book-flow')).toBeVisible();
 await expect.poll(()=>page.locator('.book-flow').evaluate(el=>getComputedStyle(el).transform)).toBe(original);
 await page.locator('.reading-zones').click({position:{x:190,y:220}});
 await expect(page.getByRole('button',{name:'Закладка'})).toHaveAttribute('aria-pressed','true');
 // Toggling again deletes the same location.
 await page.getByRole('button',{name:'Закладка'}).click();
 await expect(page.getByRole('button',{name:'Закладка'})).toHaveAttribute('aria-pressed','false');
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await page.getByRole('button',{name:'Закладки'}).click();
 await expect(page.locator('.bookmark-item')).toHaveCount(0);
});
