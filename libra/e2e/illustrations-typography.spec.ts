import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {illustratedEpub} from './support/illustratedEpub';
const art=readFileSync(new URL('./support/artwork.png',import.meta.url)).toString('base64');
const paragraphs=Array.from({length:50},(_,i)=>`<p>Абзац ${i}. До <emphasis>курсив <strong>жирный</strong></emphasis> после. ${'Длинный текст для проверки позиции. '.repeat(8)}</p>`).join('');
const fb2=`<FictionBook xmlns:x="http://www.w3.org/1999/xlink"><description><title-info><book-title>Illustrated FB2</book-title><author><first-name>Автор</first-name></author><coverpage><image x:href="#art"/></coverpage></title-info></description><body><section><image x:href="#art"/><p>Подпись к изображению <a type="note" x:href="#n1">1</a></p>${paragraphs}</section></body><body name="notes"><section id="n1"><p>Полный текст сноски.</p></section></body><binary id="art" content-type="image/png">${art}</binary></FictionBook>`;
async function controls(page:Page){
 const button=page.getByRole('button',{name:'Показать управление чтением'});
 if(await button.getAttribute('aria-expanded')!=='true')await button.click();
}
async function settings(page:Page){await controls(page);await page.getByRole('button',{name:'Текст',exact:true}).click()}

for(const format of ['fb2','epub'] as const){
 test(`${format} artwork remains original on OLED and viewer returns to the same position`,async({page})=>{
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'illustrated.'+format,mimeType:format==='epub'?'application/epub+zip':'application/xml',buffer:format==='fb2'?Buffer.from(fb2):illustratedEpub(false,'Illustrated EPUB',24,false,false,art)});
  await page.locator('.continue-card').click();
  await expect(page.locator(format==='fb2'?'.book-flow':'.epub-mount iframe')).toBeVisible();
  await settings(page);await page.getByRole('button',{name:'Системный',exact:false}).click();await page.locator('.theme-swatch[data-option=oled]').click();
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  const root=format==='fb2'?page.locator('.book-flow'):page.frameLocator('.epub-mount iframe').locator('body');
  await expect.poll(()=>root.evaluate(el=>getComputedStyle(el.querySelector('p')!).fontFamily)).toContain('Arial');
  if(format==='epub'){
   const fonts=await root.evaluate(el=>[el.querySelector('p'),el.querySelector('p span')].map(node=>getComputedStyle(node!).fontFamily));
   expect(fonts[1]).toBe(fonts[0]);
   expect(await root.locator('strong').first().evaluate(el=>Number(getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(600);
  }
  const slider=page.getByRole('slider',{name:'Прогресс чтения'});await expect(slider).toBeEnabled();await slider.press('Home');
  // The tall picture may start in column two after the short introductory paragraph.
  if(format==='epub'){await slider.press('ArrowRight');await expect(slider).toHaveValue('2')}
  await page.getByRole('button',{name:'Скрыть управление чтением'}).click();
  const image=root.locator('img').first();
  await expect(image).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(image).toHaveCSS('filter','none');
  const geometry=await image.evaluate(img=>{const el=img as HTMLImageElement,r=el.getBoundingClientRect();return {w:r.width,h:r.height,nw:el.naturalWidth,nh:el.naturalHeight,limit:window.innerHeight}});
  expect(geometry.w/geometry.h).toBeCloseTo(geometry.nw/geometry.nh,2);expect(geometry.h).toBeLessThan(geometry.limit);
  const before=await page.locator('.reading-status').textContent();
  if(format==='fb2')await image.click();
  else{
   const frame=await page.locator('.epub-mount iframe').boundingBox(),box=await image.boundingBox();
   expect(frame&&box).toBeTruthy();await page.mouse.click(box!.x+box!.width/2,box!.y+box!.height/2);
  }
  const viewer=page.getByRole('dialog',{name:'Иллюстрация',exact:true});await expect(viewer).toBeVisible();await expect(viewer).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.getByRole('button',{name:'Увеличить иллюстрацию'}).click();await expect(viewer.locator('output')).toHaveText('200%');
  await page.getByRole('button',{name:'Закрыть иллюстрацию'}).click();await expect(viewer).toHaveCount(0);
  expect(await page.locator('.reading-status').textContent()).toBe(before);
  await controls(page);await page.getByRole('button',{name:'В библиотеку'}).click();await page.reload();await page.locator('.continue-card').click();
  await expect(page.locator('.reading-status')).toHaveText(before!);
  const reopened=format==='fb2'?page.locator('.book-flow'):page.frameLocator('.epub-mount iframe').locator('body');
  await expect.poll(()=>reopened.evaluate(el=>getComputedStyle(el.querySelector('p')!).fontFamily)).toContain('Arial');
 });
}

test('FB2 emphasis, notes and legacy bookmarks survive richer markup',async({page})=>{
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'notes.fb2',mimeType:'application/xml',buffer:Buffer.from(fb2.replace('<image x:href="#art"/><p>','<p>'))});
 await page.locator('.continue-card').click();await expect(page.locator('.book-flow')).toBeVisible();
 await expect(page.locator('.book-flow em').first()).toHaveCSS('font-style','italic');
 await page.locator('.book-flow .book-note-link').click();await expect(page.getByRole('dialog',{name:'Примечание',exact:true})).toContainText('Полный текст сноски.');
 await page.getByRole('button',{name:'Закрыть примечание'}).click();
 await controls(page);const slider=page.getByRole('slider',{name:'Прогресс чтения'});await expect(slider).toBeEnabled();await slider.fill('8');await slider.dispatchEvent('pointerup');
 await expect(slider).toHaveValue('8');await page.getByRole('button',{name:'Закладка',exact:true}).click();
 const before=await page.locator('.reading-status').textContent();await page.getByRole('button',{name:'В библиотеку'}).click();await page.reload();await page.locator('.continue-card').click();await expect(page.locator('.reading-status')).toHaveText(before!);
});

test('EPUB import finishes resource loading before releasing the metadata reader',async({page})=>{
 const failures:string[]=[];
 page.on('pageerror',error=>failures.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&/replaceCss|navigation/.test(message.text()))failures.push(message.text())});
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'lifecycle.epub',mimeType:'application/epub+zip',buffer:illustratedEpub(false,'Lifecycle',3,false,false,art)});
 await page.locator('.continue-card').click();await expect(page.locator('.epub-mount iframe')).toBeVisible();
 expect(failures.filter(message=>/replaceCss|navigation/.test(message))).toEqual([]);
});

test('quickly closing and reopening EPUB does not destroy pending renderer startup',async({page})=>{
 const failures:string[]=[];page.on('pageerror',error=>failures.push(error.message));
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'startup.epub',mimeType:'application/epub+zip',buffer:illustratedEpub(false,'Startup',5,false,false,art)});
 for(let attempt=0;attempt<3;attempt++){
  await page.locator('.continue-card').click();await page.getByRole('button',{name:'Показать управление чтением'}).click();await page.getByRole('button',{name:'В библиотеку'}).click();
 }
 await page.locator('.continue-card').click();await expect(page.locator('.epub-mount iframe')).toBeVisible();
 expect(failures.filter(message=>!/ResizeObserver loop/.test(message))).toEqual([]);
});
