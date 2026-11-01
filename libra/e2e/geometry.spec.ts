import { test, expect } from '@playwright/test';

/**
 * Geometry smoke checks use DOM Range fragments rather than screenshots alone.
 * Every text fragment must live inside a CSS page column vertically and horizontally.
 * This is intentionally stricter than checking that source text merely exists in DOM.
 */
const p=(text:string)=>'<p>'+text+'</p>';
const paragraphs=Array.from({length:90},(_,i)=>p(
  'Параграф '+i+'. Содержимое страницы не должно исчезать. '.repeat(3)
));
const table='<table><tr><td>Таблица: ячейка А</td><td>Таблица: ячейка Б</td></tr>'+
 '<tr><td>Строка два и подробный текст</td><td>Содержимое таблицы сохраняется</td></tr></table>';
const image='<image l:href="#large" xmlns:l="http://www.w3.org/1999/xlink"/>';
const source='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Геометрия страниц</book-title></title-info></description>'+
 '<body><section><title><p>Первая часть</p></title>'+
 paragraphs.slice(0,30).join('')+
 '<poem><stanza><v>Строка первая</v><v>Строка вторая</v></stanza></poem>'+
 table+image+paragraphs.slice(30).join('')+
 '<p>Конец книги: последняя строка.</p></section></body>'+
 '<binary id="large" content-type="image/png">iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==</binary></FictionBook>';

async function inspect(page:import('@playwright/test').Page){
 return page.locator('.book-flow').evaluate(flow=>{
  const viewport=flow.closest('.page-viewport') as HTMLElement;
  const flowBox=flow.getBoundingClientRect();
  const width=viewport.clientWidth;
  const height=viewport.clientHeight;
  const gap=parseFloat(getComputedStyle(flow).columnGap)||24;
  const stride=width+gap;
  const errors:string[]=[];
  let fragments=0,characters=0;
  const walker=document.createTreeWalker(flow,NodeFilter.SHOW_TEXT);
  let item:Node|null;
  while((item=walker.nextNode())){
   const node=item as Text;
   characters+=node.length;
   if(!node.length)continue;
   const range=document.createRange();
   range.selectNodeContents(node);
   for(const rect of Array.from(range.getClientRects())){
    if(rect.width<=.001||rect.height<=.001)continue;
    fragments++;
    const dx=rect.left-flowBox.left;
    const dy=rect.top-flowBox.top;
    // A column contains a text rectangle at X offset <= column width.
    const column=Math.max(0,Math.floor((dx+1)/stride));
    const localX=dx-column*stride;
    if(dy < -3||dy+rect.height>height+3||
       localX < -3||localX+rect.width>width+3){
     if(errors.length<10)errors.push(JSON.stringify({
       text:node.data.slice(0,30),x:Math.round(localX),y:Math.round(dy),
       width:Math.round(rect.width),height:Math.round(rect.height),
       viewportWidth:width,viewportHeight:height,column
     }));
    }
   }
  }
  const cols=Math.max(1,Math.round((flow.scrollWidth+gap)/stride));
  const figures=Array.from(flow.querySelectorAll<HTMLImageElement>('.book-figure img'))
   .map(image=>{
    const rect=image.getBoundingClientRect();
    return {height:rect.height,width:rect.width,naturalHeight:image.naturalHeight,
     loaded:image.complete&&image.naturalWidth>0,top:rect.top-flowBox.top};
   });
  return {errors,fragments,characters,cols,height,width,figures};
 });
}

test('FB2 preserves text and fits fragments across iPhone and iPad geometries',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'geometry.fb2',mimeType:'application/xml',buffer:Buffer.from(source)
 });
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 await expect(flow).toBeVisible();
 const text=await flow.innerText();
 expect(text).toContain('Таблица: ячейка А');
 expect(text).toContain('Строка вторая');
 expect(text).toContain('Конец книги: последняя строка.');
 for(let i=0;i<90;i++)expect(text).toContain('Параграф '+i+'.');
 for(const size of [{width:320,height:568},{width:375,height:667},
    {width:390,height:844},{width:430,height:932},{width:768,height:1024}]){
  await page.setViewportSize(size);
  await expect.poll(()=>flow.evaluate(el=>el.closest('.page-viewport')?.clientWidth||0))
   .toBeGreaterThan(250);
  await page.waitForTimeout(110);
  const audit=await inspect(page);
  expect(audit.fragments,'No layout fragments at '+JSON.stringify(size)).toBeGreaterThan(100);
  expect(audit.errors,'Clipped fragments at '+JSON.stringify(size)+': '+audit.errors.join('; ')).toEqual([]);
  expect(await flow.innerText(),'Content changed at '+JSON.stringify(size)).toBe(text);
 }
});

test('a tall image remains scaled inside one page without discarding later text',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'tall.fb2',mimeType:'application/xml',buffer:Buffer.from(source)
 });
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 await expect(flow).toBeVisible();
 const before=await flow.innerText();
 await page.evaluate(()=>{
   const canvas=document.createElement('canvas');
   canvas.width=280;canvas.height=1500;
   const context=canvas.getContext('2d')!;
   context.fillStyle='#b48c71';context.fillRect(0,0,canvas.width,canvas.height);
   const image=document.querySelector<HTMLImageElement>('.book-figure img')!;
   image.src=canvas.toDataURL('image/png');
 });
 await expect.poll(()=>flow.locator('img').evaluate(el=>(el as HTMLImageElement).naturalHeight)).toBe(1500);
 // On image load, the reader must recompute the page count, preserving its text.
 await page.waitForTimeout(350);
 const audit=await inspect(page);
 expect(audit.figures[0].height).toBeLessThanOrEqual(audit.height-4);
 expect(audit.errors,'Text clipped by tall illustration: '+audit.errors.join('; ')).toEqual([]);
 expect(await flow.innerText()).toBe(before);
});
