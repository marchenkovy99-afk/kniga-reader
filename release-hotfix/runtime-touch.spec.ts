import {test,expect} from '@playwright/test';
import {epubFixture} from './support/epub-fixture';
const fb2='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Проверка касаний</book-title></title-info></description><body><section><title><p>Начало</p></title>'+Array.from({length:35},(_,i)=>'<p>Фрагмент '+i+'. '+('Важные слова сохраняются без обрезки. '.repeat(10))+'</p>').join('')+'</section></body></FictionBook>';
for(const format of ['fb2','epub']){
 test(format+': first touch, duplicate click, hold selection, save quote and offline reopen',async({page,context})=>{
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('/');
  await page.locator('input[type=file]').first().setInputFiles({name:'touch.'+format,mimeType:format==='fb2'?'application/xml':'application/epub+zip',buffer:format==='fb2'?Buffer.from(fb2):epubFixture(false,'Touch EPUB',12)});
  await page.locator('.continue-card').click();
  await expect(page.locator(format==='fb2'?'.book-flow':'.epub-mount iframe')).toBeVisible();
  const zones=page.locator('.reading-zones'),box=await zones.boundingBox();
  const point={identifier:1,clientX:box.x+box.width/2,clientY:box.y+box.height/2};
  await zones.dispatchEvent('touchstart',{touches:[point],changedTouches:[point]});
  await zones.dispatchEvent('touchend',{touches:[],changedTouches:[point]});
  await expect(page.locator('.reading-top')).toHaveClass(/visible/);
  await zones.dispatchEvent('click',{clientX:point.clientX,clientY:point.clientY});
  await expect(page.locator('.reading-top')).toHaveClass(/visible/);
  await page.getByRole('button',{name:'Скрыть управление чтением'}).click();
  const paragraph=format==='fb2'?page.locator('.book-paragraph').first():page.frameLocator('.epub-mount iframe').locator('p').first();
  const held=await paragraph.evaluate(el=>{
   const walker=el.ownerDocument.createTreeWalker(el,NodeFilter.SHOW_TEXT);const node=walker.nextNode();
   const range=el.ownerDocument.createRange();range.setStart(node,0);range.setEnd(node,Math.min(7,node.textContent.length));
   const rect=range.getClientRects()[0],frame=el.ownerDocument.defaultView.frameElement,offset=frame?frame.getBoundingClientRect():{left:0,top:0};
   return {identifier:2,clientX:rect.left+rect.width/2+offset.left,clientY:rect.top+rect.height/2+offset.top};
  });
  await zones.dispatchEvent('touchstart',{touches:[held],changedTouches:[held]});
  await expect(page.getByRole('group',{name:'Действия с выделенной цитатой'})).toBeVisible();
  await zones.dispatchEvent('touchend',{touches:[],changedTouches:[held]});
  await page.getByRole('button',{name:'Сохранить цитату'}).click();
  await expect(page.locator('.quote-notice')).toContainText('Цитата сохранена');
  await page.getByRole('button',{name:'Показать управление чтением'}).click();
  await page.getByRole('button',{name:'В библиотеку'}).click();
  await page.getByRole('button',{name:'Цитаты',exact:true}).click();
  await expect(page.locator('.saved-quote')).toHaveCount(1);
  await page.getByRole('button',{name:'Перейти к тексту'}).click();
  await expect(page.locator(format==='fb2'?'.book-flow':'.epub-mount iframe')).toBeVisible();
  expect(errors).toEqual([]);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});
  await expect.poll(()=>page.evaluate(async()=>{const keys=await caches.keys();return keys.some(key=>key.startsWith('libra-offline-'))})).toBe(true);
  await context.setOffline(true);await page.reload();
  await expect(page.locator('.reading-root, .continue-card').first()).toBeVisible();
  expect(await page.evaluate(()=>navigator.onLine)).toBe(false);
 });
}
test('vertical movement and touch cancellation do not open controls',async({page})=>{
 await page.goto('/');await page.locator('input[type=file]').first().setInputFiles({name:'vertical.fb2',mimeType:'application/xml',buffer:Buffer.from(fb2)});
 await page.locator('.continue-card').click();await expect(page.locator('.book-flow')).toBeVisible();
 const zones=page.locator('.reading-zones'),box=await zones.boundingBox(),p={identifier:1,clientX:box.x+box.width/2,clientY:box.y+box.height/2};
 await zones.dispatchEvent('touchstart',{touches:[p]});const moved={...p,clientY:p.clientY+80};
 await zones.dispatchEvent('touchmove',{touches:[moved]});await zones.dispatchEvent('touchend',{touches:[],changedTouches:[moved]});
 await expect(page.locator('.reading-top')).not.toHaveClass(/visible/);
 await zones.dispatchEvent('touchstart',{touches:[p]});await zones.dispatchEvent('touchcancel',{touches:[],changedTouches:[p]});
 await zones.dispatchEvent('touchend',{touches:[],changedTouches:[p]});await expect(page.locator('.reading-top')).not.toHaveClass(/visible/);
});
