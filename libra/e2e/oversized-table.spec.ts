import {test,expect} from '@playwright/test';
const longCell='Начало длинной ячейки. '+('Содержимое таблицы доступно полностью. '.repeat(150))+' Конец длинной ячейки.';
const fixture='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
'<description><title-info><book-title>Большая таблица</book-title></title-info></description>'+
'<body><section><title><p>Глава</p></title><p>Перед таблицей.</p>'+
'<table><tr><td>Первый столбец</td><td>'+longCell+'</td></tr><tr><td>Данные</td><td>Последняя ячейка</td></tr></table>'+
'<p>После таблицы, текст книги продолжается.</p></section></body></FictionBook>';
test('giant table opens full content in separate scrollable viewer without blocking the book',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'large-table.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)});
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('После таблицы, текст книги продолжается.');
 const launcher=page.getByRole('button',{name:/Большая таблица/});
 await expect(launcher).toBeVisible();
 await launcher.click();
 const dialog=page.getByRole('dialog',{name:'Таблица книги'});
 await expect(dialog).toBeVisible();
 await expect(dialog).toContainText('Начало длинной ячейки.');
 await expect(dialog).toContainText('Конец длинной ячейки.');
 await expect(dialog).toContainText('Последняя ячейка');
 await dialog.getByRole('button',{name:'Закрыть таблицу'}).click();
 await expect(dialog).not.toBeVisible();
 await expect(page.locator('.book-flow')).toContainText('После таблицы, текст книги продолжается.');
});
