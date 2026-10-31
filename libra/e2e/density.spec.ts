import {test,expect} from '@playwright/test';

const paragraphs=Array.from({length:160},(_,i)=>
 '<p>Строка '+i+'. '+'В этом издании важно сохранить расположение всех символов. '.repeat(6)+'</p>').join('');
const source='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Проверка заполняемости</book-title></title-info></description>'+
 '<body><section><title><p>Начало</p></title>'+paragraphs+
 '<p>Завершение книги: слово КОНЕЦ.</p></section></body></FictionBook>';

test('type sizes 14, 18, 24 preserve chapter content and avoid massive page gaps',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({
  name:'density.fb2',mimeType:'application/xml',buffer:Buffer.from(source)
 });
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 await expect(flow).toBeVisible();
 const original=await flow.innerText();
 expect(original).toContain('КОНЕЦ');
 for(const fontSize of [14,18,24]){
  if(!await page.locator('.reading-bottom').evaluate(el=>el.classList.contains('visible'))){
   await page.locator('.reading-zones').click({position:{x:190,y:220}});
  }
  await expect(page.locator('.reading-bottom')).toHaveClass(/visible/);
  await page.getByRole('button',{name:'Текст'}).click();
  await page.locator('.sheet-settings input[type=range]').first().fill(String(fontSize));
  await page.getByRole('button',{name:'Закрыть'}).click();
  await expect.poll(()=>flow.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(fontSize);
  // Account for font-face reflow and retain source text exactly.
  const assessment=await flow.evaluate(element=>{
   const viewport=element.closest('.page-viewport') as HTMLElement;
   const width=viewport.clientWidth;
   const height=viewport.clientHeight;
   const gap=parseFloat(getComputedStyle(element).columnGap)||24;
   const stride=width+gap;
   const line=parseFloat(getComputedStyle(element).lineHeight);
   const left=element.getBoundingClientRect().left;
   const bottoms=new Map<number,number>();
   const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
   let node:Node|null;
   while((node=walker.nextNode())){
    const range=document.createRange();
    range.selectNodeContents(node);
    for(const rect of Array.from(range.getClientRects())){
     if(rect.height<1||rect.width<1)continue;
     const x=rect.left-left;
     const col=Math.max(0,Math.floor((x+1)/stride));
     const y=rect.bottom-element.getBoundingClientRect().top;
     bottoms.set(col,Math.max(bottoms.get(col)||0,y));
    }
   }
   const total=Math.max(1,Math.round((element.scrollWidth+gap)/stride));
   const blanks=Array.from({length:total-1},(_,index)=>height-(bottoms.get(index)||0));
   return {line,total,height,blanks};
  });
  // Ordinary prose should consume the available vertical space, except
  // for a few lines reserved by orphans/widows and the heading.
  const extreme=assessment.blanks.filter(n=>n>assessment.line*5+8);
  expect(extreme,JSON.stringify({fontSize,assessment})).toEqual([]);
  expect(await flow.innerText()).toBe(original);
 }
});
