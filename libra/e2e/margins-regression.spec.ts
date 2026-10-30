import {test,expect} from '@playwright/test';

/**
 * Regression: changing "Поля" could shift a translated CSS column to the
 * right and clip the end of Russian lines on iPhone. Audit actual fragment
 * coordinates, not merely their presence in the DOM.
 */
const paragraphs=Array.from({length:110},(_,i)=>'<p>'+
 'Проверка '+i+'. '+'Многие дети и взрослые сталкиваются с непредсказуемыми последствиями. '.repeat(4)+
 ' Исследования эмоциональной реабилитации и психологической травмы.</p>').join('');
const book='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Точное размещение текста</book-title></title-info></description>'+
 '<body><section><title><p>Глава первая</p></title>'+paragraphs+
 '<p>ПОСЛЕДНИЙ АБЗАЦ НА МЕСТЕ</p></section></body></FictionBook>';
type Stats={errors:string[],width:number,contentWidth:number,margin:number,selected:number,count:number,visible:number};
async function geometry(page:import('@playwright/test').Page):Promise<Stats>{
 return page.locator('.book-flow').evaluate(flow=>{
  const viewport=flow.closest('.page-viewport') as HTMLElement;
  const region=flow.closest('.page-region') as HTMLElement;
  const rect=flow.getBoundingClientRect();
  const width=viewport.clientWidth,height=viewport.clientHeight;
  const gap=parseFloat(getComputedStyle(flow).columnGap)||24;
  const stride=Number((flow as HTMLElement).dataset.columnStride)||width+gap;
  const errors:string[]=[];
  // Independent measurement of the actual second-column start.
  const origin=rect.left;
  const candidates=Array.from(flow.children).slice(0,120).flatMap(el=>Array.from(el.getClientRects()).map(r=>r.left-origin));
  const second=candidates.filter(x=>x>width+gap-8&&x<width+gap+12).sort((a,b)=>Math.abs(a-(width+gap))-Math.abs(b-(width+gap)))[0];
  if(second!==undefined&&Math.abs(second-stride)>1)errors.push('stride mismatch: measured='+second+' expected='+stride);
  let visible=0;
  let selected=0;
  const value=(flow as HTMLElement).style.transform;
  const match=value.match(/translate3d\(-([\d.]+)px/);
  if(match)selected=Math.round(Number(match[1])/stride);
  const walker=document.createTreeWalker(flow,NodeFilter.SHOW_TEXT);
  let node:Node|null;
  while((node=walker.nextNode())){
   if(!node.textContent?.trim())continue;
   const range=document.createRange();range.selectNodeContents(node);
   for(const r of Array.from(range.getClientRects())){
    if(r.width<1||r.height<1)continue;
    const x=r.left-rect.left;
    const column=Math.max(0,Math.floor((x+1)/stride));
    const localX=x-column*stride;
    if(column===selected)visible++;
    if(localX< -3||localX+r.width>width+3||r.top-rect.top< -3||r.bottom-rect.top>height+3){
     if(errors.length<12)errors.push('col='+column+' x='+localX.toFixed(1)+' width='+r.width.toFixed(1)+' page='+width+' '+node.textContent?.slice(0,25));
    }
   }
  }
  const count=Math.max(1,Math.round((flow.scrollWidth+gap)/stride));
  const style=getComputedStyle(region);
  const margin=parseFloat(style.paddingLeft);
  return {errors,width,contentWidth:rect.width,margin,selected,count,visible};
 });
}
test('changing margins never pushes Russian text outside page, including mid-book',async({page})=>{
 test.setTimeout(95000);
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'margins.fb2',mimeType:'application/xml',buffer:Buffer.from(book)});
 await expect(page.locator('.continue-card')).toBeVisible();
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 await expect(flow).toBeVisible();
 const original=await flow.innerText();
 const width=page.viewportSize()!.width;
 for(let i=0;i<4;i++)await page.locator('.reading-zones').click({position:{x:width*.89,y:240}});
 for(const [margin,font] of [[12,18],[36,18],[12,25],[36,25],[20,28],[12,14]]){
  if(!await page.locator('.reading-bottom').evaluate(el=>el.classList.contains('visible')))
   await page.locator('.reading-zones').click({position:{x:width/2,y:240}});
  await page.getByRole('button',{name:'Текст'}).click();
  await page.locator('.sheet-settings input[type=range]').nth(2).fill(String(margin));
  await page.locator('.sheet-settings input[type=range]').first().fill(String(font));
  await page.getByRole('button',{name:'Закрыть'}).click();
  await expect.poll(async()=>{const v=await geometry(page);return v.margin===margin&&Math.abs(v.width-v.contentWidth)<=1}).toBe(true);
  const audit=await geometry(page);
  expect(audit.errors,'Margins '+margin+' font '+font+': '+audit.errors.join('; ')).toEqual([]);
  expect(audit.visible,'Blank page after margin/font change').toBeGreaterThan(0);
  expect(await flow.innerText()).toBe(original);
 }
 await page.reload();
 await page.locator('.continue-card').click();
 expect(await page.locator('.book-flow').innerText()).toBe(original);
 const audit=await geometry(page);
 expect(audit.errors,'After reload '+audit.errors.join('; ')).toEqual([]);
});
