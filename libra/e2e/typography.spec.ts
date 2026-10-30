import {test,expect} from '@playwright/test';

const lines=Array.from({length:48},(_,i)=>
 '<p>Абзац '+i+'. '+('Равные расстояния между словами сохраняются при перелистывании. '.repeat(4))+'</p>').join('');
const fixture='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Пробелы и интервалы</book-title></title-info></description>'+
 '<body><section>'+lines+'<p>ФИНАЛЬНЫЙ_АБЗАЦ_НЕ_ПОТЕРЯН</p></section></body></FictionBook>';

test('legacy book remains readable with even spaces and extended persistent typography',async({page})=>{
 test.setTimeout(65000);
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'typography.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toContainText('ФИНАЛЬНЫЙ_АБЗАЦ_НЕ_ПОТЕРЯН');
 const original=await page.locator('.book-flow').innerText();
 await page.locator('.reading-zones').click({position:{x:190,y:240}});
 await page.getByRole('button',{name:'Текст'}).click();
 await page.getByRole('button',{name:/Книжный/}).click();
 const sliders=page.locator('.sheet-settings input[type=range]');
 await sliders.nth(3).fill('2.5'); // word spacing
 await sliders.nth(4).fill('0.5'); // letter spacing
 await sliders.nth(5).fill('1.5'); // indent
 await sliders.nth(6).fill('8');   // paragraph gap
 await sliders.nth(7).fill('20');  // top and bottom
 await page.getByRole('button',{name:'Закрыть'}).click();
 await expect.poll(()=>page.locator('.book-flow').evaluate(el=>getComputedStyle(el).wordSpacing)).toBe('2.5px');
 const style=await page.locator('.book-flow').evaluate(el=>{
  const s=getComputedStyle(el),p=getComputedStyle(el.querySelector('.book-paragraph')!);
  const region=getComputedStyle(el.closest('.page-region')!);
  return {alignment:s.textAlign,wordSpacing:s.wordSpacing,letterSpacing:s.letterSpacing,
   indent:p.textIndent,paragraphSpace:p.marginBottom,top:region.top,font:s.fontFamily};
 });
 expect(style.alignment).toBe('left');
 expect(style.wordSpacing).toBe('2.5px');
 expect(style.letterSpacing).toBe('0.5px');
 expect(style.paragraphSpace).toBe('8px');
 expect(style.font).toMatch(/Iowan|Palatino/);
 expect(await page.locator('.book-flow').innerText()).toBe(original);
 await page.reload();
 await page.locator('.continue-card').click();
 await expect(page.locator('.book-flow')).toBeVisible();
 expect(await page.locator('.book-flow').innerText()).toBe(original);
 await expect.poll(()=>page.locator('.book-flow').evaluate(el=>getComputedStyle(el).wordSpacing)).toBe('2.5px');
 await page.locator('.reading-zones').click({position:{x:190,y:240}});
 await page.getByRole('button',{name:'Текст'}).click();
 await expect(page.getByRole('button',{name:/Книжный/})).toHaveAttribute('aria-pressed','true');
 await expect(sliders.nth(6)).toHaveValue('8');
});

test('new LIBRA icon and iPhone touch icon have installable PNG assets',async({page,request})=>{
 await page.goto('/');
 await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href',/icon-180\.png(?:\?v=\d+)?$/);
 for(const src of ['/icon-180.png','/icon-512.png','/icon.svg']){
  const response=await request.get(src);
  expect(response.ok(),src).toBe(true);
  expect((await response.body()).byteLength,src).toBeGreaterThan(300);
 }
 const manifest=await (await request.get('/manifest.webmanifest')).json();
 expect(manifest.icons.some((x:any)=>x.src==='./icon-512.png')).toBe(true);
});
