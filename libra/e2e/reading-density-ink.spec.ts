import {test,expect} from '@playwright/test';

const book='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Настройки плотности</book-title></title-info></description>'+
 '<body><section>'+Array.from({length:70},(_,i)=>'<p>Абзац '+i+'. '+('Полный текст остаётся видимым и верхняя строка остаётся чёткой. '.repeat(3))+'</p>').join('')+
 '<p>ПОСЛЕДНЕЕ_СЛОВО_НЕ_ПРОПАЛО</p></section></body></FictionBook>';

test('compact OLED text survives reload and retains all book text',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({name:'density-ink.fb2',mimeType:'application/xml',buffer:Buffer.from(book)});
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 await expect(flow).toBeVisible();
 const original=await flow.innerText();
 await page.locator('.reading-zones').click({position:{x:190,y:225}});
 await page.getByRole('button',{name:'Текст'}).click();
 await page.locator('.theme-options button[data-option="oled"]').click();
 await page.getByRole('slider',{name:'Яркость текста'}).fill('70');
 await page.getByRole('button',{name:'Максимум текста'}).click();
 await page.getByRole('button',{name:'Закрыть'}).click();
 await expect.poll(()=>page.locator('.page-region').evaluate(el=>{
  const s=getComputedStyle(el);return [s.paddingLeft,s.paddingRight];
 })).toEqual(['0px','0px']);
 const ink=await flow.evaluate(el=>getComputedStyle(el).color);
 expect(ink).not.toBe('rgb(242, 242, 239)');
 expect(await flow.innerText()).toBe(original);
 await page.reload();
 await page.locator('.continue-card').click();
 await expect(flow).toBeVisible();
 expect(await flow.innerText()).toBe(original);
 await expect.poll(()=>flow.evaluate(el=>getComputedStyle(el).color)).toBe(ink);
 await page.locator('.reading-zones').click({position:{x:190,y:225}});
 await page.getByRole('button',{name:'Текст'}).click();
 await expect(page.getByRole('slider',{name:'Яркость текста'})).toHaveValue('70');
});
