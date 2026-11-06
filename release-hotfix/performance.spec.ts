import {test,expect} from '@playwright/test';
test('large FB2 opens and survives repeated reading sessions with measured timings',async({page,context})=>{
 test.setTimeout(90000);await context.route('https://qwnkigorqsgugcctnfmj.supabase.co/**',r=>r.abort());
 const source='<FictionBook><description><title-info><book-title>Large audit fixture</book-title></title-info></description><body><section>'+Array.from({length:2400},(_,i)=>'<p>'+i+'. '+('Проверяем сохранность большого текста. '.repeat(6))+'</p>').join('')+'</section></body></FictionBook>';
 const start=Date.now();await page.goto('/');const shellMs=Date.now()-start;
 let at=Date.now();await page.locator('input[type=file]').first().setInputFiles({name:'large.fb2',mimeType:'text/xml',buffer:Buffer.from(source)});await expect(page.locator('.continue-card')).toBeVisible();const importMs=Date.now()-at;
 const reopenMs:number[]=[];let paragraphs=0;
 for(let i=0;i<5;i++){
  at=Date.now();await page.locator('.continue-card').click();await expect(page.locator('.page-viewport')).toHaveAttribute('data-ready','true');reopenMs.push(Date.now()-at);
  paragraphs=await page.locator('.book-flow .book-paragraph').count();expect(paragraphs).toBe(2400);
  await page.getByRole('button',{name:'Показать управление чтением'}).click();await page.getByRole('button',{name:'В библиотеку'}).click();
 }
 const metrics={browser:test.info().project.name,sourceBytes:Buffer.byteLength(source),paragraphs,shellMs,importMs,firstOpenMs:reopenMs[0],reopenMs:reopenMs.slice(1)};
 console.log('LIBRA_PERFORMANCE '+JSON.stringify(metrics));await test.info().attach('performance.json',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});
});
