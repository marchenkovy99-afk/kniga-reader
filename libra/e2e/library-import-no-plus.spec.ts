import {test,expect} from '@playwright/test';

const fixture='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
'<description><title-info><book-title>Проверка импорта</book-title></title-info></description>'+
'<body><section><p>Текст книги после переноса импорта.</p></section></body></FictionBook>';

test('library has no header plus and still imports books via settings',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Библиотека',exact:true})).toBeVisible();
 await expect(page.locator('.library-header .round-action')).toHaveCount(0);
 await expect(page.locator('.library-header').getByRole('button',{name:'Добавить книгу'})).toHaveCount(0);
 await page.locator('.app-tabbar').getByRole('button',{name:'Настройки'}).click();
 await expect(page.getByRole('button',{name:'Добавить книгу (FB2, EPUB)'})).toBeVisible();
 await page.locator('input[type=file]').first().setInputFiles({
  name:'still-importable.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await page.locator('.app-tabbar').getByRole('button',{name:'Библиотека'}).click();
 await expect(page.locator('.continue-card')).toBeVisible();
 await expect(page.locator('.book-tile-open')).toContainText('Проверка импорта');
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('Текст книги после переноса импорта.');
});
