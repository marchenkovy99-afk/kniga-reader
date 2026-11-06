import {test,expect} from '@playwright/test';
const book='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Время чтения</book-title></title-info></description><body><section><p>'+('Проверяем время чтения открытой страницы. '.repeat(300))+'</p></section></body></FictionBook>';
test('reading time runs on visible text, pauses for settings and exit, survives reload',async({page})=>{
 await page.goto('/');await page.locator('input[type=file]').first().setInputFiles({name:'time.fb2',mimeType:'application/xml',buffer:Buffer.from(book)});
 await page.locator('.book-tile .book-open').click();await expect(page.locator('.book-flow')).toBeVisible();
 const saved=()=>page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('libra-reading-time:v1:')).reduce((sum,[,value])=>sum+JSON.parse(value).total,0));
 await expect.poll(saved).toBeGreaterThan(1000);
 await page.getByRole('button',{name:'Показать управление чтением'}).click();
 await expect(page.locator('[data-libra-reading-time]')).toBeVisible();
 await page.getByRole('button',{name:'Текст',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 const paused=await saved();await page.waitForTimeout(1300);expect(await saved()).toBe(paused);
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();await expect.poll(saved).toBeGreaterThan(paused+500);
 await page.getByRole('button',{name:'В библиотеку'}).click();await expect(page.locator('.reading-root')).toHaveCount(0);
 const exited=await saved();await page.waitForTimeout(1300);expect(await saved()).toBe(exited);
 await page.reload();expect(await saved()).toBe(exited);
});
