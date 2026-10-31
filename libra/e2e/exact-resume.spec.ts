import {test,expect} from '@playwright/test';

const fixture='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'+
 '<description><title-info><book-title>Точная страница</book-title></title-info></description>'+
 '<body>'+[36,18,8].map((n,c)=>'<section><title><p>Глава '+(c+1)+'</p></title>'+
 Array.from({length:n},(_,i)=>'<p>Абзац '+c+'-'+i+'. '+
 'Читатель должен вернуться к той же самой странице после полного перезапуска. '.repeat(7)+
 '</p>').join('')+'</section>').join('')+'</body></FictionBook>';

test('iPhone: reopen exact book-wide page after app restart and return to library',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'resume.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await page.locator('.continue-card').click();
 const status=page.getByRole('button',{name:'Показать управление чтением'});
 await expect(status).toBeVisible();
 await status.click();
 const slider=page.getByRole('slider',{name:'Прогресс чтения'});
 await expect(slider).toBeEnabled({timeout:60000});
 const caption=await page.locator('.reading-progress span').innerText();
 const total=Number(/из ([0-9]+)/.exec(caption)?.[1]);
 expect(total).toBeGreaterThan(16);
 const target=Math.min(20,total-3);
 await page.getByRole('button',{name:'Страница',exact:true}).click();
 await page.getByRole('spinbutton').fill(String(target));
 await page.getByRole('button',{name:'Перейти',exact:true}).click();
 await expect(status).toContainText(target+' / '+total);
 const before=await page.evaluate(async()=>{
  const storage=await import('/src/storage.ts');
  const book=(await storage.listBooks())[0];
  return book.position;
 });
 expect(before?.globalPage).toBe(target);
 const bookChapter=before!.chapter,chapterPage=before!.page;
 const bookTimestamp=before!.updatedAt;
 const visibleAnchor=async()=>page.evaluate(async()=>{
  const {getPageAnchor}=await import('/src/anchors.ts');
  const {listBooks}=await import('/src/storage.ts');
  const current=(await listBooks())[0].position!;
  const root=document.querySelector<HTMLElement>('.book-flow')!;
  return getPageAnchor(root,current.page,{width:root.clientWidth,gap:24,
   stride:Number(root.dataset.columnStride)});
 });
 const textBefore=await visibleAnchor();
 expect(textBefore).toBeTruthy();
 // Fully closing and reopening the standalone browser window is represented
 // by a hard page reload with IndexedDB and localStorage retained.
 await page.reload();
 await expect(status).toBeVisible({timeout:60000});
 await expect(status).toContainText(target+' /', {timeout:60000});
 const after=await page.evaluate(async()=>{
  const storage=await import('/src/storage.ts');
  const book=(await storage.listBooks())[0];
  return book.position;
 });
 expect(after?.globalPage).toBe(target);
 expect(after?.chapter).toBe(bookChapter);
 expect(after?.page).toBe(chapterPage);
 expect(after?.updatedAt).toBe(bookTimestamp);
 expect(await visibleAnchor()).toEqual(textBefore);
 await page.waitForTimeout(500);
 expect((await page.evaluate(async()=>(await (await import('/src/storage.ts')).listBooks())[0].position))?.updatedAt).toBe(bookTimestamp);
 // Also verify the explicit library/back path, which clears the active
 // session but must retain the per-book checkpoint.
 await page.locator('.reading-zones').click({position:{x:170,y:220}});
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await page.locator('.continue-card').click();
 await expect(status).toContainText(target+' /', {timeout:60000});
 expect((await page.evaluate(async()=>(await (await import('/src/storage.ts')).listBooks())[0].position))?.updatedAt).toBe(bookTimestamp);
 expect(await visibleAnchor()).toEqual(textBefore);
});

test('iPhone: two-column Safari reflow restores the original text and page number',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'reflow.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await page.locator('.continue-card').click();
 const status=page.getByRole('button',{name:'Показать управление чтением'});
 await expect(status).toBeVisible();
 await status.click();
 await expect(page.getByRole('slider',{name:'Прогресс чтения'})).toBeEnabled({timeout:60000});
 const total=Number(/из ([0-9]+)/.exec(await page.locator('.reading-progress span').innerText())?.[1]);
 const target=Math.min(20,total-3);
 expect(target).toBeGreaterThan(5);
 await page.getByRole('button',{name:'Страница',exact:true}).click();
 await page.getByRole('spinbutton').fill(String(target));
 await page.getByRole('button',{name:'Перейти',exact:true}).click();
 await expect(status).toContainText(target+' /');
 const original=await page.evaluate(async()=>{
  const {getPageAnchor}=await import('/src/anchors.ts');
  const {listBooks}=await import('/src/storage.ts');
  const position=(await listBooks())[0].position!;
  const flow=document.querySelector<HTMLElement>('.book-flow')!;
  return getPageAnchor(flow,position.page,{
   width:flow.clientWidth,gap:24,stride:Number(flow.dataset.columnStride)});
 });
 expect(original).toBeTruthy();
 // Reproduce a Safari resume where the old physical column is two pages
 // ahead of the same source anchor in a newly measured layout.
 await page.evaluate(async()=>{
  const storage=await import('/src/storage.ts');
  const book=(await storage.listBooks())[0];
  const current=book.position!;
  await storage.savePosition(book.id,{...current,page:current.page+2,
   globalPage:current.globalPage,layoutKey:'older-iphone-column-layout',
   updatedAt:current.updatedAt+100});
 });
 await page.reload();
 await expect(status).toBeVisible({timeout:60000});
 await expect(status).toContainText(target+' /',{timeout:60000});
 const actual=await page.evaluate(async()=>{
  const {getPageAnchor}=await import('/src/anchors.ts');
  const flow=document.querySelector<HTMLElement>('.book-flow')!;
  const stride=Number(flow.dataset.columnStride);
  const translation=/translateX\(-([\d.]+)px\)/.exec(flow.style.transform);
  const column=translation?Math.round(Number(translation[1])/stride):0;
  return {column,anchor:getPageAnchor(flow,column,{width:flow.clientWidth,gap:24,stride})};
 });
 expect(actual.anchor).toEqual(original);
 const persisted=await page.evaluate(async()=>(await (await import('/src/storage.ts')).listBooks())[0].position);
 // Restoration must not write a fabricated "page turn" over the checkpoint.
 expect(persisted?.globalPage).toBe(target);
});

test('iPhone: the last of two rapid real page turns survives a complete reload',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'two-turns.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await page.locator('.continue-card').click();
 const status=page.getByRole('button',{name:'Показать управление чтением'});
 await expect(status).toBeVisible();
 await status.click();
 await expect(page.getByRole('slider',{name:'Прогресс чтения'})).toBeEnabled({timeout:60000});
 const total=Number(/из ([0-9]+)/.exec(await page.locator('.reading-progress span').innerText())?.[1]);
 const base=Math.min(20,total-5);
 expect(base).toBeGreaterThan(5);
 await page.getByRole('button',{name:'Страница',exact:true}).click();
 await page.getByRole('spinbutton').fill(String(base));
 await page.getByRole('button',{name:'Перейти',exact:true}).click();
 await expect(status).toContainText(base+' /');
 const width=await page.locator('.reading-zones').evaluate(el=>el.getBoundingClientRect().width);
 for(let step=1;step<=2;step++){
  await page.locator('.reading-zones').click({position:{x:width-10,y:170}});
  await expect(status).toContainText((base+step)+' /');
 }
 const last=await page.evaluate(async()=>{
  const storage=await import('/src/storage.ts');
  const id=(await storage.listBooks())[0].id;
  return storage.readBookCheckpoint(id);
 });
 expect(last?.globalPage).toBe(base+2);
 await page.reload();
 await expect(status).toContainText((base+2)+' /',{timeout:60000});
 await status.click();
 await page.getByRole('button',{name:'В библиотеку'}).click();
 await page.locator('.continue-card').click();
 await expect(status).toContainText((base+2)+' /',{timeout:60000});
});

test('iPhone: restores the confirmed book page while the chapter index is incomplete',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/');
 await page.locator('input[type=file]').first().setInputFiles({
  name:'indexing.fb2',mimeType:'application/xml',buffer:Buffer.from(fixture)
 });
 await page.locator('.continue-card').click();
 const status=page.getByRole('button',{name:'Показать управление чтением'});
 await expect(status).toBeVisible();
 await status.click();
 await expect(page.getByRole('slider',{name:'Прогресс чтения'})).toBeEnabled({timeout:60000});
 const total=Number(/из ([0-9]+)/.exec(await page.locator('.reading-progress span').innerText())?.[1]);
 const target=Math.min(20,total-5);
 await page.getByRole('button',{name:'Страница',exact:true}).click();
 await page.getByRole('spinbutton').fill(String(target));
 await page.getByRole('button',{name:'Перейти',exact:true}).click();
 await expect(status).toContainText(target+' /');
 await page.evaluate(async()=>{
  const storage=await import('/src/storage.ts');
  const book=(await storage.listBooks())[0];
  const old=book.position!;
  await storage.savePosition(book.id,{...old,pageCounts:undefined,updatedAt:old.updatedAt+10});
 });
 await page.reload();
 await expect(status).toContainText(new RegExp('(?:'+target+' /|Страница '+target+')'),{timeout:60000});
 const last=await page.evaluate(async()=>{
  const storage=await import('/src/storage.ts');
  const book=(await storage.listBooks())[0];
  return storage.readBookCheckpoint(book.id);
 });
 expect(last?.globalPage).toBe(target);
});
