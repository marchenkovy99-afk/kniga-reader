import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const blocks=Array.from({length:75},(_,i)=>'<p>Страница '+i+'. '+
 'Это исходный текст книги для проверки резервного копирования. '.repeat(6)+'</p>').join('');
const original='<?xml version="1.0" encoding="UTF-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Архив LIBRA</book-title><author><first-name>Тест</first-name><last-name>Чтение</last-name></author></title-info></description>'+
 '<body><section><title><p>Глава первая</p></title>'+blocks+
 '<p>КОНЕЦ КНИГИ БЕЗ ПОТЕРЬ</p></section></body></FictionBook>';
const bytes=Buffer.from(original,'utf8');

async function librarySettings(page:import('@playwright/test').Page){
 await page.getByRole('button',{name:'Настройки'}).click();
 await expect(page.getByRole('button',{name:'Скачать копию библиотеки'})).toBeVisible();
}
test('backup export and additive restore recover exact book bytes, bookmarks and reading position',async({page})=>{
 test.setTimeout(70000);
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'complete.fb2',mimeType:'application/xml',buffer:bytes});
 await page.locator('.continue-card').click();
 for(let i=0;i<3;i++)await page.locator('.reading-zones').click({position:{x:340,y:230}});
 const position=await page.locator('.book-flow').evaluate(el=>(el as HTMLElement).style.transform);
 await page.locator('.reading-zones').click({position:{x:190,y:230}});
 await page.getByRole('button',{name:'Закладка'}).click();
 await expect(page.getByRole('button',{name:'Закладка'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await librarySettings(page);
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button',{name:'Скачать копию библиотеки'}).click()
 ]);
 expect(download.suggestedFilename()).toMatch(/^libra-backup-.*\.json$/);
 const saved=await readFile(await download.path()!);
 const archive=JSON.parse(saved.toString('utf8'));
 expect(archive.format).toBe('LIBRA_BACKUP');
 expect(archive.version).toBe(1);
 expect(archive.books).toHaveLength(1);
 expect(Buffer.from(archive.books[0].bytesBase64,'base64')).toEqual(bytes);
 expect(archive.books[0].bookmarks).toHaveLength(1);
 expect(archive.books[0].position.page).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Библиотека'}).click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('.book-tile-menu').click();
 await page.getByRole('button',{name:'Удалить книгу'}).click();
 await expect(page.locator('.book-tile')).toHaveCount(0);
 await librarySettings(page);
 await page.getByLabel('Выбрать резервную копию LIBRA').setInputFiles({
  name:'backup.libra.json',mimeType:'application/json',buffer:saved
 });
 await expect(page.getByRole('status')).toContainText('Добавлено книг: 1');
 await page.getByRole('button',{name:'Библиотека'}).click();
 await expect(page.locator('.book-tile')).toHaveCount(1);
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('КОНЕЦ КНИГИ БЕЗ ПОТЕРЬ');
 await expect.poll(()=>page.locator('.book-flow').evaluate(el=>(el as HTMLElement).style.transform)).toBe(position);
 // After reopening a book the reader chrome is hidden. A centre tap reveals
 // the back button; clicking it without revealing the toolbar times out.
 await page.locator('.reading-zones').click({position:{x:190,y:230}});
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await page.getByRole('button',{name:'Закладки'}).click();
 await expect(page.locator('.bookmark-item')).toHaveCount(1);
 await page.reload();
 await page.getByRole('button',{name:'Закладки'}).click();
 await expect(page.locator('.bookmark-item')).toHaveCount(1);
});

test('invalid backup never deletes or changes an existing book',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'safe.fb2',mimeType:'application/xml',buffer:bytes});
 await librarySettings(page);
 const [download]=await Promise.all([page.waitForEvent('download'),
  page.getByRole('button',{name:'Скачать копию библиотеки'}).click()]);
 const data=JSON.parse((await readFile(await download.path()!)).toString('utf8'));
 const encoded=data.books[0].bytesBase64 as string;
 data.books[0].bytesBase64=(encoded[0]==='A'?'B':'A')+encoded.slice(1);
 await page.getByLabel('Выбрать резервную копию LIBRA').setInputFiles({
  name:'damaged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))
 });
 await expect(page.getByRole('alert')).toContainText('Проверка целостности');
 await page.getByRole('button',{name:'Библиотека'}).click();
 await expect(page.locator('.book-tile')).toHaveCount(1);
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('КОНЕЦ КНИГИ БЕЗ ПОТЕРЬ');
});
