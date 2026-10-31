import {test,expect} from '@playwright/test';

const image=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="60" fill="#d9e5dd"/><circle cx="45" cy="30" r="16" fill="#354c42"/></svg>').toString('base64');
const fb2=`<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
 <description><title-info><book-title>Иллюстрация и текст</book-title></title-info></description>
 <body><section><p><emphasis>Курсив</emphasis> и <strong>полужирный</strong> текст.</p>
 <image l:href="#picture"/><p>Текст после иллюстрации. Проверка сохранения страницы.</p></section></body>
 <binary id="picture" content-type="image/svg+xml">${image}</binary></FictionBook>`;

test('FB2 illustration opens a zoomable reader without losing formatted text or page',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'illustration.fb2',mimeType:'application/xml',buffer:Buffer.from(fb2)});
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toBeVisible();
 await expect(page.locator('.book-paragraph em')).toHaveText('Курсив');
 await expect(page.locator('.book-paragraph strong')).toHaveText('полужирный');
 const picture=page.locator('.book-image-launch');
 await expect(picture).toHaveCount(1);
 await expect(picture.locator('img')).toHaveAttribute('src',/^data:image\/svg\+xml;base64,/);
 const before=await page.locator('.reading-status > span').first().textContent();
 await picture.click();
 const dialog=page.getByRole('dialog',{name:'Иллюстрация книги'});
 await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Увеличить изображение'}).click();
 await expect(dialog.locator('img')).toHaveCSS('width',/\d+px/);
 await expect(dialog.getByText('2×')).toBeVisible();
 await dialog.getByRole('button',{name:'Закрыть иллюстрацию'}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.locator('.reading-status > span').first()).toHaveText(before||'');
});
