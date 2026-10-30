import {test,expect} from '@playwright/test';
test('reading canvas has no blur or visible footer and recovers a complete standard line',async({page})=>{
 await page.goto('/');
 const source='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Чёткий текст</book-title></title-info></description><body><section>'+('<p>'+('Чёткий текст без эффектов и потерь. '.repeat(35))+'</p>').repeat(15)+'</section></body></FictionBook>';
 await page.locator('input[type=file]').setInputFiles({name:'clear.fb2',mimeType:'text/xml',buffer:Buffer.from(source)});
 await page.locator('.continue-card').click();
 await expect(page.locator('.page-viewport')).toHaveAttribute('data-ready','true');
 await page.addStyleTag({content:'.reading-root .book-flow{filter:blur(4px);backdrop-filter:blur(8px);mask-image:linear-gradient(transparent,black)}'});
 const geometry=await page.locator('.page-region').evaluate(el=>{
  const frame=el.closest('.reading-root')!,flow=el.querySelector('.book-flow')!,style=getComputedStyle(flow);
  const bottom=parseFloat(getComputedStyle(el).bottom),safe=parseFloat(getComputedStyle(frame).getPropertyValue('--reader-safe-bottom'))||0;
  return {filter:style.filter,backdrop:style.backdropFilter,mask:style.maskImage,bottom,safe,line:parseFloat(style.lineHeight)};
 });
 expect(geometry.filter).toBe('none');expect(geometry.backdrop).toBe('none');expect(geometry.mask).toBe('none');
 // Old geometry always reserved 28px in addition to the current bottom inset.
 expect(28).toBeGreaterThanOrEqual(geometry.line);
 expect(geometry.bottom).toBeLessThan(10);
 await expect(page.locator('.reading-status')).toHaveCSS('opacity','0');
 await page.locator('.reading-zones').click({position:{x:190,y:240}});
 await expect(page.getByRole('slider',{name:'Прогресс чтения'})).toBeVisible();
 await expect(page.locator('[role=alert]')).toHaveCount(0);
});
