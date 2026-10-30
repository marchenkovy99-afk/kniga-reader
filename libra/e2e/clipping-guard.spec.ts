import {test,expect,type Page} from '@playwright/test';
async function savedPosition(page:Page){
 return page.evaluate(()=>new Promise<unknown>((resolve,reject)=>{
  const request=indexedDB.open('libra-library');
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result;const records=db.transaction('reading','readonly').objectStore('reading').getAll();
   records.onsuccess=()=>{resolve(records.result[0]?.position);db.close()};records.onerror=()=>{reject(records.error);db.close()};
  };
 }));
}
const body=Array.from({length:45},(_,i)=>'<p>Абзац '+i+'. '+('Весь исходный текст доступен читателю без потерь. ').repeat(7)+'</p>').join('');
const source='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Защита текста</book-title></title-info></description><body><section><title><p>Глава</p></title>'+body+'<p>КОНЕЦ_ПОЛНОЙ_ГЛАВЫ</p></section></body></FictionBook>';
test('real glyph overflow raises an error and exposes the complete chapter through vertical scrolling',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({name:'clipping.fb2',mimeType:'application/xml',buffer:Buffer.from(source)});
 await page.locator('.continue-card').click();
 await expect(page.locator('.page-viewport')).toHaveAttribute('data-ready','true');
 await expect(page.locator('.reading-scroll-safe')).toHaveCount(0);
 const original=await page.locator('.book-flow').textContent();
 await expect.poll(()=>savedPosition(page)).toMatchObject({anchor:{block:expect.any(Number)}});
 const before=await savedPosition(page);
 // A source paragraph that cannot fit the actual column, without a test-only application hook.
 await page.locator('.book-flow p').first().evaluate(el=>{el.style.whiteSpace='nowrap';el.style.width='1800px'});
 await expect(page.getByRole('alert')).toContainText('Ошибка вёрстки');
 await expect(page.locator('.reading-root')).toHaveClass(/reading-scroll-safe/);
 await expect(page.locator('.reading-zones')).toBeHidden();
 expect(await page.locator('.book-flow').textContent()).toBe(original);
 const final=page.locator('.book-flow p').last();
 await page.locator('.page-viewport').evaluate(el=>{el.scrollTop=el.scrollHeight});
 await expect(final).toBeInViewport();
 expect(await savedPosition(page),'safe scrolling must retain the saved source anchor and paginated progress').toEqual(before);
 await page.getByRole('button',{name:'Показать управление чтением'}).click();
 await expect(page.getByRole('button',{name:'Текст'})).toBeVisible();
 await page.getByRole('button',{name:'Показать управление чтением'}).click();
 // Retry must run the audit again, so an unresolved error cannot simply disappear.
 await page.getByRole('button',{name:'Проверить страницы'}).click();
 await expect(page.getByRole('alert')).toContainText('Ошибка вёрстки');
 await page.locator('.book-flow p').first().evaluate(el=>{el.style.removeProperty('white-space');el.style.removeProperty('width')});
 await page.getByRole('button',{name:'Проверить страницы'}).click();
 await expect(page.locator('.reading-scroll-safe')).toHaveCount(0);
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.locator('.page-viewport')).toHaveAttribute('data-ready','true');
});


test('safe chapter navigation resets the next chapter to its start and the previous chapter to its end',async({page})=>{
 const twoChapters=source.replace('</section></body>', '</section><section><title><p>Вторая глава</p></title>'+body+'<p>КОНЕЦ_ВТОРОЙ_ГЛАВЫ</p></section></body>');
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({name:'safe-chapters.fb2',mimeType:'application/xml',buffer:Buffer.from(twoChapters)});
 await page.locator('.continue-card').click();
 await expect(page.locator('.page-viewport')).toHaveAttribute('data-ready','true');
 // Keep the same real overflow in both chapters. Scroll-safe rules restore
 // wrapping; leaving safe mode must detect this faulty paginated rule again.
 const brokenStyle=await page.addStyleTag({content:'.book-flow p { white-space:nowrap; width:1800px; }'});
 await page.locator('.book-flow p').first().evaluate(el=>{el.style.letterSpacing='.1px'});
 await expect(page.getByRole('alert')).toContainText('Ошибка вёрстки');
 await page.locator('.page-viewport').evaluate(el=>{el.scrollTop=el.scrollHeight});
 await expect(page.locator('.book-flow p').last()).toBeInViewport();
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('.book-flow .book-heading')).toHaveText('Вторая глава');
 await expect(page.getByRole('alert')).toContainText('Ошибка вёрстки');
 await expect.poll(()=>page.locator('.page-viewport').evaluate(el=>el.scrollTop)).toBe(0);
 await expect(page.locator('.book-flow .book-heading')).toBeInViewport();
 await page.keyboard.press('ArrowLeft');
 await expect(page.locator('.book-flow .book-heading')).toHaveText('Глава');
 await expect(page.getByRole('alert')).toContainText('Ошибка вёрстки');
 await expect.poll(()=>page.locator('.page-viewport').evaluate(el=>Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop))).toBeLessThan(2);
 await expect(page.locator('.book-flow p').last()).toBeInViewport();
 // A healthy following chapter must also discard the scroll offset when
 // returning to pagination; overflow:hidden alone does not reset scrollTop.
 await brokenStyle.evaluate(el=>el.remove());
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('.book-flow .book-heading')).toHaveText('Вторая глава');
 await expect(page.locator('.page-viewport')).toHaveAttribute('data-ready','true');
 await expect(page.locator('.reading-scroll-safe')).toHaveCount(0);
 await expect.poll(()=>page.locator('.page-viewport').evaluate(el=>el.scrollTop)).toBe(0);
 await expect(page.locator('.book-flow .book-heading')).toBeInViewport();
});
