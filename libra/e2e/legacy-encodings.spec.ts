import {test,expect} from '@playwright/test';
const head='<?xml version="1.0" encoding="windows-1251"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>';
const mid='</book-title></title-info></description><body><section><title><p>Глава</p></title><p>';
const tail='</p></section></body></FictionBook>';

test('legacy Windows-1251 FB2 keeps Cyrillic during import and after reload',async({page})=>{
 const fixture=Buffer.concat([
  Buffer.from(head,'ascii'),
  Buffer.from([0xca,0xed,0xe8,0xe3,0xe0,0x20,0xb9,0x31]), // Книга №1
  Buffer.from(mid,'ascii'),
  Buffer.from([0xcf,0xf0,0xe8,0xe2,0xe5,0xf2,0x20,0xec,0xe8,0xf0,0x21]), // Привет мир!
  Buffer.from(tail,'ascii')
 ]);
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'legacy.fb2',mimeType:'application/xml',buffer:fixture});
 await expect(page.locator('.continue-card')).toContainText('Книга №1');
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('Привет мир!');
 await expect(page.locator('.book-flow')).not.toContainText('\uFFFD');
 await page.reload();
 await expect(page.locator('.continue-card')).toContainText('Книга №1');
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('Привет мир!');
});
