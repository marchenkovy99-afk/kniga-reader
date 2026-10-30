import {test,expect} from '@playwright/test';

const fixture='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
'<description><title-info><book-title>Книга для библиотеки</book-title><author><first-name>Анна</first-name><last-name>Иванова</last-name></author></title-info></description>'+
'<body><section><p>Первая страница книги. Проверяем сохранность чтения и оформления.</p></section></body></FictionBook>';

test('reference-inspired library preserves import, favorites, filtering and reader theme',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Библиотека'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Все книги'})).toBeVisible();
 await expect(page.getByRole('button',{name:'В избранном'})).toHaveCount(0);
 await expect(page.locator('.library-header button')).toHaveCount(0);
 await page.locator('input[type=file]').first().setInputFiles({name:'library-design.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)});
 await expect(page.locator('.book-tile-open')).toContainText('Книга для библиотеки');
 await expect(page.locator('.continue-card')).toBeVisible();
 expect(await page.locator('.library-shell').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(21, 21, 20)');
 await expect(page.locator('.book-tile')).toHaveCount(1);
 await expect(page.locator('.reference-import')).toBeVisible();
 await page.locator('.book-tile-menu').click();
 await page.getByRole('button',{name:'В избранное',exact:true}).click();
 await expect(page.getByRole('button',{name:'В избранном'})).toHaveCount(0);
 await page.reload();
 await expect(page.locator('.book-tile')).toHaveCount(1);
 await page.locator('.book-tile-menu').click();
 await expect(page.getByRole('button',{name:'Убрать из избранного'})).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('Первая страница книги.');
 await expect(page.locator('.reading-root')).toBeVisible();
 await page.locator('.reading-zones').click({position:{x:195,y:230}});
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await expect(page.getByRole('heading',{name:'Библиотека'})).toBeVisible();
 await page.locator('.app-tabbar').getByRole('button',{name:'Настройки'}).click();
 await expect(page.getByRole('heading',{name:'Тема чтения'})).toBeVisible();
 await page.locator('.app-tabbar').getByRole('button',{name:'Библиотека'}).click();
 await expect(page.locator('.book-tile')).toHaveCount(1);
});

test('library keeps narrow iPhone controls inside viewport',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto('/');
 const x=await page.locator('.library-shell').evaluate(el=>({
  documentWidth:el.scrollWidth,
  viewportWidth:el.clientWidth,
  buttonHeight:el.querySelector('.app-tabbar button')!.getBoundingClientRect().height
 }));
 expect(x.documentWidth).toBeLessThanOrEqual(x.viewportWidth+1);
 expect(x.buttonHeight).toBeGreaterThanOrEqual(44);
 await expect(page.locator('.library-state-tabs')).toBeVisible();
 await page.locator('.app-tabbar').getByRole('button',{name:'Настройки'}).click();
 await expect(page.getByRole('button',{name:'Добавить книгу (FB2, EPUB)'})).toBeVisible();
});
