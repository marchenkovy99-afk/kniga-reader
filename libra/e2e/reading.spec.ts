import { test, expect } from '@playwright/test';

const paragraphs=Array.from({length:180},(_,i)=>'<p>Абзац '+i+': Ёж 🦔 любит длинные тексты. Содержимое не должно пропадать при перелистывании. '+('Текст продолжается без обрезания. '.repeat(3))+'</p>').join('');
const fixture=`<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info>
<book-title>Проверка пагинации</book-title><author><first-name>Автор</first-name></author>
</title-info></description><body><section><title><p>Первая глава</p></title>${paragraphs}</section></body></FictionBook>`;

test('iPhone reader keeps all 180 paragraphs in DOM during paging',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'fixture.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)});
 await expect(page.getByText('Проверка пагинации').first()).toBeVisible();
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 await expect(flow).toBeVisible();
 await expect.poll(()=>flow.evaluate(el=>el.scrollWidth)).toBeGreaterThan(350);
 const text=await flow.innerText();
 for(let i=0;i<180;i++)expect(text).toContain('Абзац '+i+': Ёж 🦔');
 const before=await flow.evaluate(el=>getComputedStyle(el).transform);
 const size=page.viewportSize()!;
 await page.mouse.click(size.width*.88,size.height*.52);
 await expect.poll(async()=>flow.evaluate(el=>getComputedStyle(el).transform)).not.toBe(before);
 const after=await flow.innerText();
 expect(after).toBe(text);
 await page.mouse.click(size.width*.12,size.height*.52);
 await expect.poll(async()=>flow.evaluate(el=>getComputedStyle(el).transform)).toBe(before);
});

test('OLED background is consistent across page shell and metadata',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Настройки'}).click();
 await page.getByRole('button',{name:'OLED'}).click();
 // Library is intentionally graphite regardless of the reading theme.
 expect(await page.locator('.library-shell').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(21, 21, 21)');
 await page.locator('input[type=file]').first().setInputFiles({name:'oled.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)});
 await page.locator('.app-tabbar').getByRole('button',{name:'Библиотека'}).click();
 await page.locator('.continue-card').click();
 const values=await page.evaluate(()=>({
  html:getComputedStyle(document.documentElement).backgroundColor,
  body:getComputedStyle(document.body).backgroundColor,
  shell:getComputedStyle(document.querySelector('.reading-root')!).backgroundColor,
  meta:document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
 }));
 expect(values.body).toBe('rgb(0, 0, 0)');
 expect(values.shell).toBe(values.body);
 expect(values.meta).toBe('#000000');
});
