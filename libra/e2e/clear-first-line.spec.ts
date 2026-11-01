import { test, expect } from '@playwright/test';

const paragraphs = Array.from({length: 70}, (_, i) =>
  '<p>Абзац '+i+'. Каждая строка книги должна оставаться отчётливой с самого верха страницы. '.repeat(3)+'</p>'
).join('');
const fb2 = '<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
  '<description><title-info><book-title>Чёткая первая строка</book-title></title-info></description>'+
  '<body><section><title><p>Глава первая</p></title>'+paragraphs+'</section></body></FictionBook>';

test('zero top margin never paints first reading line against iPhone clip or status bar', async ({page}) => {
  await page.goto('/');
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'clear-top.fb2', mimeType: 'application/xml', buffer: Buffer.from(fb2)
  });
  await page.locator('.continue-card').click();
  await expect(page.locator('.book-flow')).toBeVisible();
  await page.locator('.reading-zones').click({position:{x:190,y:220}});
  await page.getByRole('button',{name:'Текст'}).click();
  await page.locator('.sheet-settings input[type=range]').nth(7).fill('0');
  await page.getByRole('button',{name:'Закрыть'}).click();
  await expect.poll(()=>page.locator('.page-region').evaluate(el=>
    parseFloat(getComputedStyle(el).top))).toBeGreaterThanOrEqual(8);

  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932}]){
    await page.setViewportSize(viewport);
    const info=await page.locator('.page-region').evaluate((region,viewportWidth)=>{
      const root=region.closest('.reading-root')!;
      const page=region.querySelector('.page-viewport')!;
      const probe=document.createElement('div');
      probe.style.paddingTop='env(safe-area-inset-top,0px)';
      document.body.appendChild(probe);
      const safeTop=parseFloat(getComputedStyle(probe).paddingTop)||0;
      probe.remove();
      const rootTop=root.getBoundingClientRect().top;
      const top=region.getBoundingClientRect().top-rootTop;
      const clipTop=page.getBoundingClientRect().top;
      const flow=region.querySelector('.book-flow')!;
      const style=getComputedStyle(flow);
      const texts=document.createTreeWalker(flow,NodeFilter.SHOW_TEXT);
      let firstVisibleTop=Infinity;
      for(let node=texts.nextNode();node;node=texts.nextNode()){
        if(!node.textContent?.trim())continue;
        const range=document.createRange();
        range.selectNodeContents(node);
        for(const r of Array.from(range.getClientRects()))
          if(r.width>0&&r.height>0&&r.right>0&&r.left<viewportWidth&&r.bottom>=clipTop&&r.top<page.getBoundingClientRect().bottom)
            firstVisibleTop=Math.min(firstVisibleTop,r.top);
      }
      return {safeTop,top,clipTop,firstVisibleTop,filter:style.filter,mask:style.maskImage};
    },viewport.width);
    expect(info.top-info.safeTop,'top paint clearance '+viewport.width).toBeGreaterThanOrEqual(8);
    expect(info.firstVisibleTop,'first text line exists '+viewport.width).toBeLessThan(Infinity);
    expect(info.firstVisibleTop,'first line stays inside reading clip '+viewport.width).toBeGreaterThanOrEqual(info.clipTop-1);
    expect(info.filter).toBe('none');
    expect(info.mask).toBe('none');
  }
});
