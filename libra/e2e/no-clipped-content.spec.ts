import {test,expect} from '@playwright/test';

const sentence='Открытый текст должен полностью помещаться на странице. ';
const body=Array.from({length:72},(_,i)=>
 '<p>ПРОВЕРКА_АБЗАЦА_'+i+' '+sentence.repeat(4)+
 (i===37?'МНОГОСЛОЖНОЕСЛОВО_'.repeat(7):'')+'</p>').join('');
const source='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Все страницы до последней</book-title></title-info></description>'+
 '<body><section><title><p>Глава проверки</p></title>'+body+
 '<p>ПОСЛЕДНЯЯ_СТРОКА_КНИГИ_НЕ_ОБРЕЗАНА</p></section></body></FictionBook>';

async function openSettings(page:import('@playwright/test').Page){
 const panel=page.locator('.reading-bottom');
 if(!await panel.evaluate(el=>el.classList.contains('visible'))){
  const viewport=page.viewportSize()!;
  await page.locator('.reading-zones').click({position:{x:viewport.width/2,y:viewport.height/2}});
 }
 await page.getByRole('button',{name:'Текст'}).click();
}

async function checkAllFragments(page:import('@playwright/test').Page){
 return page.locator('.page-viewport > .book-flow').evaluate(flow=>{
  const viewport=flow.closest('.page-viewport') as HTMLElement;
  const stride=Number((flow as HTMLElement).dataset.columnStride);
  const width=viewport.clientWidth,height=viewport.clientHeight;
  const left=flow.getBoundingClientRect().left,top=flow.getBoundingClientRect().top;
  const gap=parseFloat(getComputedStyle(flow).columnGap)||24;
  const bad:Array<{page:number,x:number,y:number,right:number,bottom:number}>=[],seen=new Set<number>();
  const walker=document.createTreeWalker(flow,NodeFilter.SHOW_TEXT);
  let text:Node|null,rectangles=0;
  while((text=walker.nextNode())){
   if(!text.textContent?.trim())continue;
   const range=document.createRange();range.selectNodeContents(text);
   for(const rect of Array.from(range.getClientRects())){
    if(rect.width<.5||rect.height<.5)continue;
    rectangles++;
    const dx=rect.left-left;
    const base=Math.max(0,Math.floor(dx/stride));
    const remainder=dx-base*stride;
    const col=base+(remainder>width+gap*.35?1:0);
    const x=dx-col*stride,y=rect.top-top;
    seen.add(col);
    if(x< -3||x+rect.width>width+3||y< -3||y+rect.height>height+3){
      if(bad.length<12)bad.push({page:col,x,y,right:x+rect.width,bottom:y+rect.height});
    }
   }
  }
  return {bad,rectangles,maxPage:Math.max(...seen),width,height,firstPage:Math.min(...seen)};
 });
}

async function reachLastPage(page:import('@playwright/test').Page){
 const caption=await page.locator('.reading-progress span').innerText();
 const match=/Страница \d+ из (\d+)/.exec(caption);
 expect(match,'FB2 pagination count must be available').not.toBeNull();
 const total=Number(match![1]);
 expect(total).toBeGreaterThan(2);
 expect(total).toBeLessThan(300);
 // Actual user navigation rather than reading text from offscreen DOM.
 // Allow a frame between every touch-zone click so React commits each page.
 await page.locator('.reading-zones').evaluate(async (zone,number)=>{
  const rect=zone.getBoundingClientRect();
  for(let p=1;p<number;p++){
    zone.dispatchEvent(new MouseEvent('click',{bubbles:true,
      clientX:rect.left+rect.width*.89,clientY:rect.top+rect.height*.5}));
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  }
 },total);
 await expect(page.locator('.reading-progress span')).toHaveText('Страница '+total+' из '+total);
 await page.waitForTimeout(400);
 const last=await page.locator('.page-viewport > .book-flow').evaluate(flow=>{
  const vp=flow.closest('.page-viewport')!.getBoundingClientRect();
  const iterator=document.createTreeWalker(flow,NodeFilter.SHOW_TEXT);
  let node:Node|null,lastNode:Text|null=null;
  while((node=iterator.nextNode()))if(node.textContent?.trim())lastNode=node as Text;
  if(!lastNode)return null;
  const range=document.createRange();
  range.setStart(lastNode,Math.max(0,lastNode.length-1));
  range.setEnd(lastNode,lastNode.length);
  const r=range.getBoundingClientRect();
  return {lastText:lastNode.textContent,visible:r.width>0&&r.height>0&&
   r.left>=vp.left-3&&r.right<=vp.right+3&&r.top>=vp.top-3&&r.bottom<=vp.bottom+3,
   rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},
   viewport:{left:vp.left,right:vp.right,top:vp.top,bottom:vp.bottom}};
 });
 expect(last?.lastText).toContain('ПОСЛЕДНЯЯ_СТРОКА_КНИГИ_НЕ_ОБРЕЗАНА');
 expect(last?.visible,'the actual final character must be visible on the last reachable page: '+JSON.stringify(last)).toBe(true);
}

test('every fragment fits a real page and final source character is reachable after dense reflow',async({page})=>{
 test.setTimeout(150000);
 const cases=[
  {width:320,height:568,font:30,line:1.8,left:46,right:38,top:8,bottom:4},
  {width:390,height:844,font:22,line:1.45,left:10,right:12,top:12,bottom:12},
  {width:430,height:932,font:36,line:2,left:52,right:46,top:40,bottom:40}
 ];
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'full-text.fb2',mimeType:'application/xml',buffer:Buffer.from(source)
 });
 await page.locator('.continue-card').click();
 const text=await page.locator('.page-viewport > .book-flow').innerText();
 for(let i=0;i<72;i++)expect(text).toContain('ПРОВЕРКА_АБЗАЦА_'+i);
 for(const x of cases){
  await page.setViewportSize({width:x.width,height:x.height});
  await openSettings(page);
  const sliders=page.locator('.sheet-settings input[type=range]');
  await sliders.nth(0).fill(String(x.font));
  await sliders.nth(1).fill(String(x.line));
  await sliders.nth(2).fill(String(x.left));
  await sliders.nth(7).fill(String(x.top));
  await sliders.nth(8).fill(String(x.right));
  await sliders.nth(9).fill(String(x.bottom));
  await page.getByRole('button',{name:'Закрыть'}).click();
  await expect.poll(()=>page.locator('.page-viewport > .book-flow').evaluate(el=>getComputedStyle(el).fontSize)).toBe(x.font+'px');
  await page.waitForTimeout(420);
  const checked=await checkAllFragments(page);
  expect(checked.rectangles).toBeGreaterThan(100);
  expect(checked.firstPage).toBe(0);
  expect(checked.bad,'clipped glyphs at '+x.width+'x'+x.height+': '+JSON.stringify(checked.bad)).toEqual([]);
  const current=await page.locator('.reading-progress span').textContent();
  const advertised=Number(/из ([0-9]+)/.exec(current||'')?.[1]);
  expect(advertised,'all rendered text columns must be reachable with page turns')
   .toBe(checked.maxPage+1);
  expect(await page.locator('.page-viewport > .book-flow').innerText()).toBe(text);
  await reachLastPage(page);
  await page.reload();
  await page.locator('.continue-card').click();
  await expect(page.locator('.page-viewport')).toHaveAttribute('data-ready','true',{timeout:20000});
  expect(await page.locator('.page-viewport > .book-flow').innerText()).toBe(text);
 }
});
