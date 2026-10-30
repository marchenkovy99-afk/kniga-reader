import {test,expect} from '@playwright/test';
const chapter=(name:string,count:number)=>'<section><title><p>'+name+'</p></title>'+
 Array.from({length:count},(_,i)=>'<p>'+name+' абзац '+i+'. '+('Нормальная страница, без обрезки и случайного смещения текста. '.repeat(7))+'</p>').join('')+
 '<p>КОНЕЦ_'+name.replaceAll(' ','_')+'</p></section>';
const book='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Неподвижные границы глав</book-title></title-info></description><body>'+
 chapter('Глава один',36)+chapter('Глава два',24)+'</body></FictionBook>';

test('chapter boundary keeps page geometry fixed and does not animate across the previous chapter',async({page})=>{
 test.setTimeout(90000);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({name:'chapter-stability.fb2',mimeType:'application/xml',buffer:Buffer.from(book)});
 await page.locator('.continue-card').click();
 const flow=page.locator('.book-flow');
 await expect(flow).toBeVisible();
 await expect(page.locator('.page-viewport')).toHaveAttribute('data-ready','true',{timeout:20000});
 const initial=await page.locator('.page-viewport').boundingBox();
 expect(initial).toBeTruthy();
 const status=page.getByRole('button',{name:'Показать управление чтением'});
 await status.click();
 await page.getByRole('button',{name:'Оглавление'}).click();
 await page.getByRole('button',{name:'Глава два',exact:true}).click();
 await expect(flow).toContainText('КОНЕЦ_Глава_два');
 await expect(page.locator('.page-viewport')).toHaveAttribute('data-ready','true',{timeout:20000});
 // The transition must finish in a stable state. WebKit and Chromium
 // may report a zero computed duration for accessibility/device reasons;
 // verify that the app itself released its reflow lock instead.
 await expect.poll(()=>flow.evaluate(el=>el.classList.contains('no-animation'))).toBe(false);
 const forward=await page.locator('.page-viewport').boundingBox();
 expect(forward).toEqual(initial);
 // From the first page of chapter two, back must go directly to the final
 // page of chapter one without an intermediary first-page translation.
 const states:{page:number;ready:string|null;transform:string;duration:string}[]=[];
 await page.evaluate(()=>{
  (window as any).__chapterFrames=[];
  let count=0;const observe=()=>{
   const el=document.querySelector('.book-flow') as HTMLElement|null;
   const viewport=document.querySelector('.page-viewport');
   (window as any).__chapterFrames.push({
    page:Number(/translateX\\(-?(\\d+(?:\\.\\d+)?)px\\)/.exec(el?.style.transform||'')?.[1]||0),
    ready:viewport?.getAttribute('data-ready')||null,
    transform:el?.style.transform||'',
    duration:el?getComputedStyle(el).transitionDuration:''
   });
   if(++count<100)requestAnimationFrame(observe);
  };
  requestAnimationFrame(observe);
 });
 await page.locator('.reading-zones').click({position:{x:40,y:250}});
 await expect(flow).toContainText('КОНЕЦ_Глава_один',{timeout:20000});
 await expect(page.locator('.page-viewport')).toHaveAttribute('data-ready','true',{timeout:20000});
 // The bottom toolbar is normally hidden while reading, so page
 // readiness must be checked through its stable viewport state, not hidden text.
 await expect(page.locator('.page-viewport')).toHaveAttribute('data-ready','true');
 const back=await page.locator('.page-viewport').boundingBox();
 expect(back).toEqual(initial);
 const text=await flow.innerText();
 expect(text).toContain('КОНЕЦ_Глава_один');
 const stats=await page.evaluate(()=>(window as any).__chapterFrames as Array<{page:number;ready:string|null;transform:string;duration:string}>);
 // Any provisional chapter frame must be non-animated; the reading column's
 // horizontal shift cannot be tweened over several screens on chapter load.
 expect(stats.filter(f=>f.ready==='false'&&f.duration!=='0s')).toEqual([]);
 const final=await flow.evaluate(el=>{
  const content=el.querySelector('p:last-child')!,range=document.createRange();
  range.selectNodeContents(content);
  const r=range.getBoundingClientRect(),vp=el.closest('.page-viewport')!.getBoundingClientRect();
  return r.left>=vp.left-3&&r.right<=vp.right+3&&r.top>=vp.top-3&&r.bottom<=vp.bottom+3;
 });
 expect(final).toBe(true);
});
