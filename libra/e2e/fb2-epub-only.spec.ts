import {test,expect} from '@playwright/test';

test('LIBRA imports only FB2 and EPUB and never exposes a PDF reading flow',async({page})=>{
 await page.goto('/');
 const chooser=page.locator('input[type=file]').first();
 await expect(chooser).toHaveAttribute('accept','.fb2,.epub');
 await expect(page.locator('.library-greeting')).toHaveText('Ваша библиотека · FB2 и EPUB');
 await chooser.setInputFiles({name:'ineligible.pdf',mimeType:'application/pdf',
  buffer:Buffer.from('%PDF-1.4\n')});
 await expect(page.locator('.app-error')).toContainText('Поддерживаются только FB2 и EPUB');
 await expect(page.locator('.book-tile')).toHaveCount(0);
 await page.getByRole('button',{name:'Закрыть'}).click();
 const book='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
  '<description><title-info><book-title>Чтение работает</book-title></title-info></description>'+
  '<body><section><p>Содержимое первой страницы.</p>'+
  '<p>ПОСЛЕДНИЙ_АБЗАЦ_НЕ_ИСЧЕЗ</p></section></body></FictionBook>';
 await chooser.setInputFiles({name:'book.fb2',mimeType:'application/xml',buffer:Buffer.from(book)});
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('ПОСЛЕДНИЙ_АБЗАЦ_НЕ_ИСЧЕЗ');
 await expect(page.locator('.app-error')).toHaveCount(0);
});
