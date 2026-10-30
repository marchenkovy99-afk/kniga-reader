import {test,expect} from '@playwright/test';
const source='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Сквозные страницы</book-title></title-info></description><body>'+[35,9,1].map((n,c)=>'<section><title><p>Глава '+(c+1)+'</p></title>'+Array.from({length:n},(_,i)=>'<p>Абзац '+i+'. '+('Равномерный текст без пропусков сохраняется на каждой странице книги. '.repeat(7))+'</p>').join('')+'<p>КОНЕЦ_ГЛАВЫ_'+(c+1)+'</p></section>').join('')+'</body></FictionBook>';
test('whole-book slider, page jump, hidden footer and restored final character',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'navigation.fb2',mimeType:'application/xml',buffer:Buffer.from(source)});
 await page.locator('.continue-card').click();
 await expect(page.locator('.page-viewport > .book-flow')).toBeVisible();
 const status=page.getByRole('button',{name:'Показать управление чтением'});
 await expect(status).toBeVisible();
 await status.click();
 const slider=page.getByRole('slider',{name:'Прогресс чтения'});
 await expect(slider).toBeEnabled();
 const initial=await page.locator('.reading-progress span').innerText();
 const total=Number(/из (\d+)/.exec(initial)?.[1]);
 expect(total).toBeGreaterThan(10);
 // Native keyboard interaction, not a programmatic handler invocation.
 await slider.focus();
 await slider.press('End');
 await expect(page.locator('.page-viewport > .book-flow')).toContainText('КОНЕЦ_ГЛАВЫ_3');
 await expect(page.locator('.reading-progress span')).toHaveText('Страница '+total+' из '+total);
 await expect(page.locator('.reading-progress strong')).toHaveText('100%');
 await page.getByRole('button',{name:'Страница',exact:true}).click();
 await page.getByRole('spinbutton').fill('2');
 await page.getByRole('button',{name:'Перейти',exact:true}).click();
 await expect(page.locator('.page-viewport > .book-flow')).toContainText('КОНЕЦ_ГЛАВЫ_1');
 await expect(status).toContainText('2 / '+total);
 // Jump into the middle of a later, multi-page chapter. Repeat font-ready
 // measurements must preserve the exact requested page, not reset to page1.
 await status.click();
 await page.getByRole('button',{name:'Страница',exact:true}).click();
 const later=total-3;
 await page.getByRole('spinbutton').fill(String(later));
 await page.getByRole('button',{name:'Перейти',exact:true}).click();
 await expect(status).toContainText(later+' / '+total);
 await page.waitForTimeout(450);
 await expect(status).toContainText(later+' / '+total);
 await status.click();
 await slider.focus();await slider.press('End');
 await page.keyboard.press('Escape');
 const bounds=await page.locator('.page-viewport').evaluate(el=>{
  const r=el.getBoundingClientRect(),footer=document.querySelector('.reading-root')!.getBoundingClientRect();
  return {textBottom:r.bottom,footerTop:footer.bottom,height:r.height};
 });
 expect(bounds.textBottom).toBeLessThanOrEqual(bounds.footerTop);
 expect(bounds.height).toBeGreaterThan(page.viewportSize()!.height-90);
 await expect.poll(()=>page.locator('.page-viewport > .book-flow p').last().evaluate(el=>{
  const range=document.createRange();range.selectNodeContents(el);range.setStart(el.firstChild!,el.firstChild!.textContent!.length-1);
  const r=range.getBoundingClientRect(),vp=el.closest('.page-viewport')!.getBoundingClientRect();
  return r.left>=vp.left-2&&r.right<=vp.right+2&&r.top>=vp.top-2&&r.bottom<=vp.bottom+2;
 })).toBe(true);
 await page.reload();await page.locator('.continue-card').click();
 await expect(page.locator('.page-viewport > .book-flow')).toContainText('КОНЕЦ_ГЛАВЫ_3');
 await expect(status).toContainText('100%');
});
