import {test,expect} from '@playwright/test';

const first=Array.from({length:75},(_,i)=>'<p>Первая глава: строка '+i+'. '+('Текст в первой главе без пропусков. '.repeat(4))+'</p>').join('');
const second=Array.from({length:30},(_,i)=>'<p>Вторая глава: строка '+i+'. '+('Текст во второй главе без пропусков. '.repeat(4))+'</p>').join('');
const fixture='<?xml version="1.0" encoding="utf-8"?>'+
 '<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Границы глав</book-title></title-info></description>'+
 '<body><section><title><p>Первая глава</p></title>'+first+
 '<p>КОНЕЦ_ПЕРВОЙ_ГЛАВЫ</p></section>'+
 '<section><title><p>Вторая глава</p></title>'+second+
 '<p>КОНЕЦ_ВТОРОЙ_ГЛАВЫ</p></section></body>'+
 '<body name="notes"><section><title><p>Примечания</p></title>'+
 '<p>ФИНАЛЬНОЕ_ПРИМЕЧАНИЕ</p></section></body></FictionBook>';

test('switching between chapters preserves last page and all body content',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'chapters.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 await expect(flow).toBeVisible();
 await expect(flow).toContainText('КОНЕЦ_ПЕРВОЙ_ГЛАВЫ');
 for(let i=0;i<75;i++)expect(await flow.innerText()).toContain('Первая глава: строка '+i+'.');
 await page.locator('.reading-zones').click({position:{x:190,y:220}});
 await page.getByRole('button',{name:'Оглавление'}).click();
 await page.getByRole('button',{name:/^Вторая глава(?:\s|$)/}).click();
 await expect(flow).toContainText('КОНЕЦ_ВТОРОЙ_ГЛАВЫ');
 for(let i=0;i<30;i++)expect(await flow.innerText()).toContain('Вторая глава: строка '+i+'.');
 await expect(flow).not.toContainText('КОНЕЦ_ПЕРВОЙ_ГЛАВЫ');
 // Back from the first page of chapter two should land at the LAST page
 // of chapter one, not at its beginning or in an unrelated chapter.
 await page.getByRole('button',{name:'Показать управление чтением'}).click();
 await expect(page.getByRole('slider',{name:'Прогресс чтения'})).toBeEnabled();
 await expect(page.locator('.reading-progress span')).toHaveText(/Страница \d+ из \d+/);
 const secondStart=await page.locator('.reading-progress span').innerText();
 const secondPage=Number(/Страница (\d+)/.exec(secondStart)?.[1]);
 expect(secondPage).toBeGreaterThan(1);
 await page.locator('.reading-zones').click({position:{x:45,y:220}});
 await expect(flow).toContainText('КОНЕЦ_ПЕРВОЙ_ГЛАВЫ');
 await expect.poll(async()=>Number(/Страница (\d+)/.exec(await page.locator('.reading-progress span').innerText())?.[1])).toBe(secondPage-1);
 await page.locator('.reading-zones').click({position:{x:340,y:220}});
 await expect(flow).toContainText('КОНЕЦ_ВТОРОЙ_ГЛАВЫ');
 await expect(page.locator('.reading-progress span')).toHaveText(secondStart);
 // The trailing FB2 <body name=notes> must be preserved as its own chapter.
 if(!await page.locator('.reading-bottom').evaluate(el=>el.classList.contains('visible'))){
  await page.getByRole('button',{name:'Показать управление чтением'}).click();
 }
 await page.getByRole('button',{name:'Оглавление'}).click();
 await page.getByRole('button',{name:'Примечания',exact:true}).click();
 await expect(flow).toContainText('ФИНАЛЬНОЕ_ПРИМЕЧАНИЕ');
 await page.reload();
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('ФИНАЛЬНОЕ_ПРИМЕЧАНИЕ');
});
