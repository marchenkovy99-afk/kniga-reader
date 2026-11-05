import {test,expect} from '@playwright/test';
const book='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Сегодняшние обновления</book-title></title-info></description><body><section><title><p>Первая глава</p></title>'+Array.from({length:30},(_,i)=>'<p>Фрагмент '+i+'. '+('Текст для проверки сохранения страницы. '.repeat(25))+'</p>').join('')+'</section><section><title><p>Вторая глава</p></title><p>Следующая глава книги.</p></section></body></FictionBook>';
async function add(page){await page.goto('/');await page.locator('input[type=file]').first().setInputFiles({name:'today.fb2',mimeType:'application/xml',buffer:Buffer.from(book)});}
async function ready(page){await expect(page.locator('.book-flow')).toBeVisible();await expect(page.locator('.reading-status')).toContainText(/\d+ \/ \d+/);}
async function touchCenter(page){const zones=page.locator('.reading-zones'),box=await zones.boundingBox(),point={identifier:1,clientX:box.x+box.width/2,clientY:box.y+box.height/2};await zones.dispatchEvent('touchstart',{touches:[point]});await zones.dispatchEvent('touchend',{touches:[],changedTouches:[point]});}
test('read/unread book moves between filters and survives reload',async({page})=>{
 await add(page);await page.getByRole('button',{name:'Действия с книгой «Сегодняшние обновления»'}).click();
 await page.getByRole('button',{name:'В прочитанные',exact:true}).click();
 await page.getByRole('button',{name:'Прочитано',exact:true}).click();await expect(page.locator('.book-tile')).toHaveCount(1);
 await page.reload();await page.getByRole('button',{name:'Прочитано',exact:true}).click();await expect(page.locator('.book-tile')).toHaveCount(1);
 await page.getByRole('button',{name:'Действия с книгой «Сегодняшние обновления»'}).click();
 await page.getByRole('button',{name:'Вернуть в «Читаю»',exact:true}).click();
 await page.getByRole('button',{name:'Читаю',exact:true}).click();await expect(page.locator('.book-tile')).toHaveCount(1);
});
test('panels overlay text; dark headings, half-point fonts, chapter pages, bookmarks and exact reopen work',async({page})=>{
 await add(page);await page.locator('.continue-card').click();await ready(page);
 const before=await page.locator('.book-paragraph').first().boundingBox();await touchCenter(page);
 await expect(page.locator('.reading-top')).toHaveClass(/visible/);
 const after=await page.locator('.book-paragraph').first().boundingBox();expect(after.x).toBe(before.x);expect(after.y).toBe(before.y);
 await page.getByRole('button',{name:'Текст',exact:true}).click();
 const size=page.locator('.sheet-settings label').filter({hasText:'Размер текста'}).locator('input');
 await size.evaluate(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'23.5');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 await expect(size).toHaveValue('23.5');
 await page.locator('.theme-swatch[data-option="oled"]').click();await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await expect.poll(()=>page.locator('.book-flow').evaluate(el=>getComputedStyle(el).fontSize)).toBe('23.5px');
 const heading=page.locator('.book-flow h1,.book-flow h2,.book-flow h3').first();
 const color=await heading.evaluate(el=>getComputedStyle(el).color);expect(Math.max(...color.match(/[0-9.]+/g).slice(0,3).map(Number))).toBeGreaterThan(100);
 await page.getByRole('button',{name:'Скрыть управление чтением'}).click();await ready(page);
 await expect(page.locator('.reading-status')).toContainText('До конца главы:');
 const first=await page.locator('.reading-status').textContent(),n1=Number(first.match(/До конца главы: (\d+)/)[1]);
 const zones=page.locator('.reading-zones'),box=await zones.boundingBox(),p={identifier:2,clientX:box.x+box.width*.8,clientY:box.y+box.height/2},q={...p,clientX:box.x+box.width*.2};
 await zones.dispatchEvent('touchstart',{touches:[p]});await zones.dispatchEvent('touchmove',{touches:[q]});await zones.dispatchEvent('touchend',{touches:[],changedTouches:[q]});
 await expect.poll(()=>page.locator('.reading-status').textContent()).not.toBe(first);
 const status=await page.locator('.reading-status').textContent(),n2=Number(status.match(/До конца главы: (\d+)/)[1]);expect(n2).toBe(n1-1);
 const pageNumber=status.match(/(\d+) \/ (\d+)/)[1];
 await touchCenter(page);await page.getByRole('button',{name:'Закладка',exact:true}).click();await expect(page.getByRole('button',{name:'Закладка',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'В библиотеку'}).click();await page.locator('.continue-card').click();await ready(page);
 await expect(page.locator('.reading-status')).toContainText(pageNumber+' / ');
 await touchCenter(page);await page.getByRole('button',{name:'Текст',exact:true}).click();await expect(size).toHaveValue('23.5');
 await expect(page.locator('.theme-swatch[data-option="oled"]')).toHaveClass(/chosen/);
});
test('first touch still opens controls after repeatedly closing and reopening the book',async({page})=>{
 await add(page);
 for(let i=0;i<3;i++){await page.locator('.continue-card').click();await ready(page);await touchCenter(page);await expect(page.locator('.reading-top')).toHaveClass(/visible/);await page.getByRole('button',{name:'В библиотеку'}).click();}
});
