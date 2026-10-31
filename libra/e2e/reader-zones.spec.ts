import { test, expect } from '@playwright/test';

const body=Array.from({length:140},(_,i)=>'<p>Параграф '+i+'. '+('Проверка координат переключения страницы. '.repeat(7))+'</p>').join('');
const fixture='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Зоны чтения</book-title></title-info></description><body><section><title><p>Глава</p></title>'+body+'</section></body></FictionBook>';

test('tap zones use centered reader width on wide iPad/desktop viewport',async({page})=>{
 await page.setViewportSize({width:2048,height:1024});
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'zones.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)});
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 const zone=page.locator('.reading-zones');
 await expect(flow).toBeVisible();
 await expect.poll(()=>flow.evaluate(el=>el.scrollWidth)).toBeGreaterThan(2000);
 const width=await zone.evaluate(el=>el.clientWidth);
 expect(width).toBeLessThan(900);
 const original=await flow.evaluate(el=>getComputedStyle(el).transform);
 await zone.click({position:{x:width-24,y:300}});
 await expect.poll(()=>flow.evaluate(el=>getComputedStyle(el).transform)).not.toBe(original);
 await zone.click({position:{x:24,y:300}});
 await expect.poll(()=>flow.evaluate(el=>getComputedStyle(el).transform)).toBe(original);
 await zone.click({position:{x:width/2,y:300}});
 await expect(page.locator('.reading-bottom')).toHaveClass(/visible/);
});
