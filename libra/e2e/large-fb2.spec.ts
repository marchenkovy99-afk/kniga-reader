import {test,expect} from '@playwright/test';

/**
 * A single oversized chapter stresses the editor's real CSS columns and the
 * content anchor index. No synthetic pagination: all text stays in the DOM.
 */
const chapters=Array.from({length:2400},(_,i)=>
 '<p>Большая книга, абзац '+String(i).padStart(4,'0')+'. '+('Полный текст сохраняется при перелистывании. '.repeat(3))+'</p>').join('');
const fixture='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Длинная глава</book-title></title-info></description>'+
 '<body><section><title><p>Начало длинной главы</p></title>'+chapters+
 '<p>ПОСЛЕДНИЙ АБЗАЦ СОХРАНЁН</p></section></body></FictionBook>';

test('2400-paragraph chapter retains original text across taps, font change and reload',async({page})=>{
 test.setTimeout(60000);
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'large.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 await expect(flow).toBeVisible({timeout:20000});
 await expect(flow.locator('.book-paragraph')).toHaveCount(2401,{timeout:20000});
 const original=await flow.innerText();
 expect(original).toContain('абзац 0000');
 expect(original).toContain('абзац 2399');
 expect(original).toContain('ПОСЛЕДНИЙ АБЗАЦ СОХРАНЁН');
 const before=await flow.evaluate(el=>(el as HTMLElement).style.transform);
 for(let i=0;i<12;i++)await page.locator('.reading-zones').click({position:{x:340,y:250}});
 await expect.poll(()=>flow.evaluate(el=>(el as HTMLElement).style.transform)).not.toBe(before);
 await expect(flow).toContainText('абзац 2399');
 expect(await flow.innerText()).toBe(original);
 await page.locator('.reading-zones').click({position:{x:190,y:250}});
 await page.getByRole('button',{name:'Текст'}).click();
 await page.locator('.sheet-settings input[type=range]').first().fill('23');
 await page.getByRole('button',{name:'Закрыть'}).click();
 await expect.poll(()=>flow.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(23);
 expect(await flow.innerText()).toBe(original);
 await page.reload();
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toBeVisible({timeout:20000});
 expect(await page.locator('.book-flow').innerText()).toBe(original);
});
