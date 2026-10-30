import {expect,test} from '@playwright/test';

/**
 * Every text fragment in every native CSS column is checked for containment.
 * Checking only the visible page misses drift after dozens of page turns.
 */
const prose=Array.from({length:96},(_,i)=>'<p>'+
 'Абзац '+i+'. '+'Проверяем весь исходный текст и положение каждого слова на странице. '.repeat(4)+
 ' Unicode: mañana, café, Ελληνικά, 日本語, 😀📚. '+
 (i%8===0?'СУПЕРДЛИННОЕ_НЕПРЕРЫВНОЕ_СЛОВО_12345678901234567890_ЕЩЕ_НЕСКОЛЬКО_СИМВОЛОВ. ':'')+
 '</p>').join('');
const chapter='<?xml version="1.0" encoding="UTF-8"?>'+
 '<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Все строки целиком</book-title></title-info></description>'+
 '<body><section><title><p>Заголовок раздела</p></title>'+
 prose+'<p>КОНТРОЛЬ_ПОСЛЕДНЕГО_АБЗАЦА</p></section></body></FictionBook>';

type Violation={page:number;left:number;right:number;top:number;bottom:number;snippet:string};
type Audit={total:number;columns:number;width:number;height:number;bad:Violation[]};
async function audit(page:import('@playwright/test').Page):Promise<Audit>{
 return page.locator('.book-flow').evaluate(flow=>{
  const viewport=flow.closest('.page-viewport') as HTMLElement;
  const width=viewport.clientWidth,height=viewport.clientHeight;
  const stride=Number((flow as HTMLElement).dataset.columnStride)||width+24;
  const gap=parseFloat(getComputedStyle(flow).columnGap)||24;
  const origin=flow.getBoundingClientRect();
  let total=0;const bad:Violation[]=[];
  const iterator=document.createTreeWalker(flow,NodeFilter.SHOW_TEXT);
  let node:Node|null;
  while((node=iterator.nextNode())){
   if(!node.textContent?.trim())continue;
   const range=document.createRange();range.selectNodeContents(node);
   for(const r of Array.from(range.getClientRects())){
    if(r.width<.5||r.height<.5)continue;
    total++;
    const x=r.left-origin.left;
    const base=Math.max(0,Math.floor(x/stride));
    const rem=x-base*stride;
    const column=base+(rem>width+gap*.35?1:0);
    const left=x-column*stride;
    const top=r.top-origin.top;
    if(left< -3||left+r.width>width+3||top< -3||top+r.height>height+3){
     if(bad.length<15)bad.push({page:column,left,right:left+r.width,top,bottom:top+r.height,
      snippet:(node.textContent||'').slice(0,40)});
    }
   }
  }
  return {total,columns:Math.round((flow.scrollWidth+gap)/stride),width,height,bad};
 });
}
async function openSettings(page:import('@playwright/test').Page){
 const panel=page.locator('.reading-bottom');
 if(!await panel.evaluate(el=>el.classList.contains('visible'))){
  const size=page.viewportSize()!;
  await page.locator('.reading-zones').click({position:{x:size.width/2,y:Math.min(220,size.height/2)}});
 }
 await page.getByRole('button',{name:'Текст'}).click();
}
test('all source text and line fragments survive asymmetric margins, high font size and viewport changes',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'stress.fb2',mimeType:'application/xml',buffer:Buffer.from(chapter)
 });
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 await expect(flow).toContainText('КОНТРОЛЬ_ПОСЛЕДНЕГО_АБЗАЦА');
 const original=await flow.innerText();
 const cases=[
  {width:390,height:844,left:6,right:52,top:0,bottom:50,font:18},
  {width:320,height:568,left:50,right:6,top:50,bottom:0,font:26},
  {width:430,height:932,left:52,right:52,top:40,bottom:40,font:36},
  {width:768,height:1024,left:12,right:24,top:16,bottom:30,font:22}
 ];
 for(const x of cases){
  await page.setViewportSize({width:x.width,height:x.height});
  await openSettings(page);
  const sliders=page.locator('.sheet-settings input[type=range]');
  await sliders.nth(0).fill(String(x.font));
  await sliders.nth(2).fill(String(x.left));
  await sliders.nth(7).fill(String(x.top));
  await sliders.nth(8).fill(String(x.right));
  await sliders.nth(9).fill(String(x.bottom));
  await sliders.nth(10).fill('600');
  await page.getByRole('button',{name:'Закрыть'}).click();
  await expect.poll(async()=>page.locator('.page-region').evaluate(el=>{
   const r=getComputedStyle(el);return [r.paddingLeft,r.paddingRight].join(',');
  })).toBe(x.left+'px,'+x.right+'px');
  await page.waitForTimeout(380);
  const checked=await audit(page);
  expect(checked.total,'no text fragments at '+x.width).toBeGreaterThan(100);
  expect(checked.bad,'clipped fragments at '+x.width+': '+JSON.stringify(checked)).toEqual([]);
  expect(await flow.innerText()).toBe(original);
 }
 await page.reload();
 await page.locator('.continue-card').click();
 expect(await page.locator('.book-flow').innerText()).toBe(original);
 const reloaded=await audit(page);
 expect(reloaded.bad,'after reload '+JSON.stringify(reloaded)).toEqual([]);
});
test('separate margin controls, hyphenation and reset remain usable',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'controls.fb2',mimeType:'application/xml',buffer:Buffer.from(chapter)
 });
 await page.locator('.continue-card').click();
 await openSettings(page);
 const sliders=page.locator('.sheet-settings input[type=range]');
 await sliders.nth(8).fill('42');
 await sliders.nth(9).fill('30');
 await sliders.nth(10).fill('600');
 await expect(page.getByLabel('Предпросмотр типографики')).toBeVisible();
 await page.getByRole('button',{name:'Перенос слов'}).click();
 await expect(page.getByRole('button',{name:'Перенос слов'})).toContainText('Выключен');
 await page.getByRole('button',{name:'Закрыть'}).click();
 await expect.poll(()=>page.locator('.book-flow').evaluate(el=>getComputedStyle(el).hyphens)).toBe('none');
 await page.reload();
 await page.locator('.continue-card').click();
 await openSettings(page);
 await expect(sliders.nth(8)).toHaveValue('42');
 await expect(sliders.nth(9)).toHaveValue('30');
 await expect(sliders.nth(10)).toHaveValue('600');
 await page.getByRole('button',{name:'Сбросить настройки текста'}).click();
 await expect(sliders.nth(8)).toHaveValue('16');
 await expect(sliders.nth(9)).toHaveValue('2');
 await expect(sliders.nth(10)).toHaveValue('400');
});
