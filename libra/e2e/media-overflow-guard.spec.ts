import {test,expect} from '@playwright/test';

const cell=('Содержимое важной ячейки полностью доступно. ').repeat(6);
const source='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Таблицы и иллюстрации</book-title></title-info></description>'+
 '<body><section><title><p>Глава</p></title><p>Перед иллюстрацией.</p>'+
 '<image l:href="#tall" xmlns:l="http://www.w3.org/1999/xlink"/>'+
 '<table><tr><td>Колонка</td><td>'+cell+'</td></tr>'+
 '<tr><td>Последняя строка</td><td>Проверка</td></tr></table>'+
 '<p>ПОСЛЕ_ТАБЛИЦЫ_И_ИЛЛЮСТРАЦИИ_ТЕКСТ_СОХРАНЕН</p>'+
 '</section></body>'+
 '<binary id="tall" content-type="image/png">iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==</binary></FictionBook>';

test('tall image fits its page and tall table remains fully accessible on a narrow screen',async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:320,height:568});
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'media.fb2',mimeType:'application/xml',buffer:Buffer.from(source)
 });
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('ПОСЛЕ_ТАБЛИЦЫ');
 await page.locator('.reading-zones').click({position:{x:160,y:280}});
 await page.getByRole('button',{name:'Текст'}).click();
 const sliders=page.locator('.sheet-settings input[type=range]');
 await sliders.nth(0).fill('36');
 await sliders.nth(1).fill('2.2');
 await sliders.nth(2).fill('50');
 await sliders.nth(8).fill('50');
 await sliders.nth(7).fill('48');
 await sliders.nth(9).fill('48');
 await page.getByRole('button',{name:'Закрыть'}).click();
 await expect.poll(()=>page.locator('.book-flow').evaluate(el=>getComputedStyle(el).fontSize)).toBe('36px');
 await page.locator('.book-flow img').evaluate((image:HTMLImageElement)=>{
  const canvas=document.createElement('canvas');
  canvas.width=80;canvas.height=1600;
  const ctx=canvas.getContext('2d')!;
  ctx.fillRect(0,0,80,1600);
  image.src=canvas.toDataURL('image/png');
 });
 await expect.poll(()=>page.locator('.book-flow img').evaluate((img:HTMLImageElement)=>img.naturalHeight)).toBe(1600);
 await expect(page.getByRole('button',{name:/Большая таблица/})).toBeVisible();
 const image=await page.locator('.book-figure').evaluate(el=>{
  const flow=el.closest('.book-flow')!;
  const view=el.closest('.page-viewport')!;
  const figure=el.getBoundingClientRect();
  const origin=flow.getBoundingClientRect();
  const img=el.querySelector('img')!.getBoundingClientRect();
  return {top:figure.top-origin.top,bottom:figure.bottom-origin.top,
   height:view.clientHeight,imageHeight:img.height};
 });
 expect(image.top).toBeGreaterThanOrEqual(-3);
 expect(image.bottom,'the figure must fit vertically inside a native CSS column').toBeLessThanOrEqual(image.height+3);
 expect(image.imageHeight).toBeGreaterThan(1);
 const launch=page.getByRole('button',{name:/Большая таблица/});
 await launch.click();
 const dialog=page.getByRole('dialog',{name:'Таблица книги'});
 await expect(dialog).toContainText(cell.trim());
 await expect(dialog).toContainText('Последняя строка');
 await dialog.getByRole('button',{name:'Закрыть таблицу'}).click();
 await expect(page.locator('.book-flow')).toContainText('ПОСЛЕ_ТАБЛИЦЫ_И_ИЛЛЮСТРАЦИИ_ТЕКСТ_СОХРАНЕН');
});
