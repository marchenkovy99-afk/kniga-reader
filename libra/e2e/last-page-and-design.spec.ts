import {test,expect} from '@playwright/test';

/** DOM content and rendered columns must agree all the way to the last page.
 * Deliberately contains headings, a long word and whitespace-sensitive verse.
 */
const paragraphs=Array.from({length:48},(_,i)=>'<p>'+
 'Текст номер '+i+'. '+('Ни одно слово не должно исчезнуть на последней странице книги. '.repeat(3))+
 (i===19?'ПРЕВОСХОДНОДЛИННОЕСЛОВОБЕЗПРОБЕЛОВ1234567890'.repeat(3):'')+
 '</p>').join('');
const fixture='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Последняя страница</book-title></title-info></description>'+
 '<body><section><title><p>Начало</p></title>'+paragraphs+
 '<p>ПОСЛЕДНЯЯ СТРОКА СОХРАНЕНА ЦЕЛИКОМ</p></section></body></FictionBook>';

test('last page remains accessible with large text and narrow asymmetric margins',async({page})=>{
 test.setTimeout(100000);
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'last-page.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 await expect(flow).toContainText('ПОСЛЕДНЯЯ СТРОКА');
 const original=await flow.innerText();
 const before=await flow.evaluate(el=>el.scrollWidth);
 expect(before).toBeGreaterThan(800);
 // Use reader settings to force multiple columns without deleting text.
 await page.locator('.reading-zones').click({position:{x:195,y:235}});
 await page.getByRole('button',{name:'Текст'}).click();
 await page.locator('.sheet-settings input[type=range]').first().fill('30');
 await page.locator('.sheet-settings input[type=range]').nth(8).fill('52');
 await page.getByRole('button',{name:'Закрыть'}).click();
 await expect.poll(()=>flow.evaluate(el=>getComputedStyle(el).fontSize)).toBe('30px');
 await page.waitForTimeout(400);
 const stats=await flow.evaluate(el=>{
  const stride=Number((el as HTMLElement).dataset.columnStride);
  const width=el.clientWidth,rect=el.getBoundingClientRect();
  const last=Array.from(el.querySelectorAll<HTMLElement>('[data-block-index]')).at(-1)!;
  const boxes=Array.from(last.getClientRects()).filter(r=>r.height>.5&&r.width>.5);
  const max=Math.max(...boxes.map(r=>Math.max(0,Math.round((r.left-rect.left)/stride))));
  const available=Math.round((el.scrollWidth+24)/stride);
  return {lastPage:max,available,width,stride};
 });
 expect(stats.available,'final content must fit inside counted pages').toBeGreaterThanOrEqual(stats.lastPage+1);
 expect(await flow.innerText()).toBe(original);
 await page.reload();
 await page.locator('.continue-card').click();
 expect(await page.locator('.book-flow').innerText()).toBe(original);
});

test('minimal library displays functional rows without colorful generated cover gradients',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'minimal.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 const tile=page.locator('.book-tile');
 await expect(tile).toBeVisible();
 const cover=tile.locator('.book-cover');
 await expect(cover.locator('.book-cover-initial')).toContainText('П');
 const result=await page.evaluate(()=>{
  const item=document.querySelector('.book-tile')!;
  const cover=document.querySelector('.book-cover')!;
  return {
   mobileGrid:getComputedStyle(document.querySelector('.book-grid')!).gridTemplateColumns,
   background:getComputedStyle(cover).backgroundImage,
   radius:getComputedStyle(cover).borderRadius,
   text:item.textContent||''
  };
 });
 expect(result.background).toBe('none');
 expect(result.text).toContain('FB2');
 expect(result.text).toContain('Последняя страница');
 await page.locator('.book-tile-open').click();
 await expect(page.locator('.book-flow')).toBeVisible();
});
