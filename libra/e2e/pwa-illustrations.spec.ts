import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('standalone startup preserves FB2 position, user font and original artwork',async({page,context,browserName})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
 await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.reload();
 const art=readFileSync(new URL('./support/artwork.png',import.meta.url)).toString('base64');
 const text=Array.from({length:30},(_,i)=>`<p>Абзац ${i} ${'Текст для автономного чтения. '.repeat(12)}</p>`).join('');
 const xml=`<FictionBook xmlns:l="http://www.w3.org/1999/xlink"><body><section><image l:href="#art"/>${text}</section></body><binary id="art" content-type="image/png">${art}</binary></FictionBook>`;
 await page.locator('input[type=file]').setInputFiles({name:'offline.fb2',mimeType:'application/xml',buffer:Buffer.from(xml)});await page.locator('.continue-card').click();await expect(page.locator('.book-flow')).toBeVisible();
 await page.getByRole('button',{name:'Показать управление чтением'}).click();await page.getByRole('button',{name:'Текст',exact:true}).click();
 await page.getByRole('button',{name:'Системный',exact:false}).click();await page.locator('.theme-swatch[data-option=oled]').click();await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 const slider=page.getByRole('slider',{name:'Прогресс чтения'});await expect(slider).toBeEnabled();await slider.fill('5');await slider.dispatchEvent('pointerup');await expect(slider).toHaveValue('5');
 const status=await page.locator('.reading-status').textContent();await page.getByRole('button',{name:'В библиотеку'}).click();
 expect(await page.evaluate(async()=>Boolean(await caches.match(location.href)))).toBe(true);
 // WebKit's automation offline mode rejects navigation before service-worker
 // fallback. Exercise actual offline reopening in Chromium and the same
 // installed-app startup/position path in WebKit with networking available.
 if(browserName==='chromium')await context.setOffline(true);
 await page.reload();await page.locator('.continue-card').click();await expect(page.locator('.book-flow')).toBeVisible();await expect(page.locator('.reading-status')).toHaveText(status!);
 await expect(page.locator('.book-flow .book-paragraph').first()).toHaveCSS('font-family',/-apple-system/);
 await page.getByRole('button',{name:'Показать управление чтением'}).click();await slider.press('Home');await expect(slider).toHaveValue('1');await page.getByRole('button',{name:'Скрыть управление чтением'}).click();
 await page.locator('.book-flow img').click();await expect(page.getByRole('dialog',{name:'Иллюстрация',exact:true})).toHaveCSS('background-color','rgb(255, 255, 255)');
 await expect(page.locator('.illustration-viewer img')).toHaveJSProperty('naturalWidth',600);
 await page.getByRole('button',{name:'Закрыть иллюстрацию'}).click();expect(await page.evaluate(()=>(navigator as any).standalone)).toBe(true);
});
