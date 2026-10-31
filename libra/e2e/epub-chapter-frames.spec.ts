import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {illustratedEpub} from './support/illustratedEpub';
const artwork=readFileSync(new URL('./support/artwork.png',import.meta.url)).toString('base64');

test('EPUB chapter turns never expose an intermediate first page or moving heading',async({page})=>{
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'boundary.epub',mimeType:'application/epub+zip',buffer:illustratedEpub(true,'Chapter frame audit',32,false,false,artwork)});
 await page.locator('.continue-card').click();
 await expect(page.locator('.epub-mount iframe')).toBeVisible();
 await page.getByRole('button',{name:'Показать управление чтением'}).click();await page.getByRole('button',{name:'Оглавление',exact:true}).click();
 await page.getByRole('button',{name:/Вторая глава/}).click();
 await expect(page.frameLocator('.epub-mount iframe').locator('body')).toContainText('SECOND CHAPTER');
 await expect(page.locator('.epub-transition-freeze')).toHaveCount(0);
 await page.evaluate(()=>{
  const frames:any[]=[];(window as any).__boundaryFrames=frames;(window as any).__boundaryAudit=true;
  const sample=()=>{
   const host=document.querySelector('.epub-mount') as HTMLElement,box=host.getBoundingClientRect();
   const overlay=host.querySelector('.epub-transition-freeze');
   const frame=host.querySelector('iframe'),doc=frame?.contentDocument;
   if(overlay)frames.push({covered:true});
   else if(doc&&frame){
    const origin=frame.getBoundingClientRect();
    const visible=Array.from(doc.querySelectorAll('h1,h2,p')).filter(el=>Array.from(el.getClientRects()).some(rect=>rect.width&&rect.height&&rect.right+origin.left>box.left+2&&rect.left+origin.left<box.right-2&&rect.bottom+origin.top>box.top&&rect.top+origin.top<box.bottom));
    frames.push({covered:false,text:visible.map(el=>el.textContent).join('|'),heading:visible[0]?visible[0].getBoundingClientRect().top+origin.top:null});
   }else frames.push({covered:false,text:''});
   if((window as any).__boundaryAudit)requestAnimationFrame(sample);
  };(window as any).__boundarySampler=sample;requestAnimationFrame(sample);
 });
 await page.locator('.reading-zones').click({position:{x:25,y:260}});
 await expect.poll(()=>page.locator('.epub-mount').evaluate(host=>{
  const frame=host.querySelector('iframe'),last=frame?.contentDocument?.querySelector('body>p:last-child');
  if(!frame||!last)return false;
  const rect=last.getBoundingClientRect(),origin=frame.getBoundingClientRect(),box=host.getBoundingClientRect();
  return last.textContent==='END OF BOOK'&&rect.left+origin.left>=box.left-2&&rect.right+origin.left<=box.right+2;
 })).toBe(true);
 await expect(page.locator('.epub-transition-freeze')).toHaveCount(0);
 const backward=await page.evaluate(()=>{(window as any).__boundaryAudit=false;return (window as any).__boundaryFrames as {covered:boolean;text?:string}[]});
 expect(backward.length).toBeGreaterThan(1);
 expect(backward.filter(frame=>!frame.covered&&/BEFORE|Passage 0\b/.test(frame.text||'')),'previous chapter page one must never flash before its last page').toEqual([]);
 await page.evaluate(()=>{(window as any).__boundaryFrames.length=0;(window as any).__boundaryAudit=true;requestAnimationFrame((window as any).__boundarySampler)});
 await page.locator('.reading-zones').click({position:{x:350,y:260}});
 await expect(page.frameLocator('.epub-mount iframe').locator('body')).toContainText('SECOND CHAPTER');
 await expect(page.locator('.epub-transition-freeze')).toHaveCount(0);
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))));
 const forward=await page.evaluate(()=>{(window as any).__boundaryAudit=false;return (window as any).__boundaryFrames as {covered:boolean;text?:string;heading?:number}[]});
 const headings=forward.filter(frame=>!frame.covered&&frame.text?.includes('SECOND CHAPTER')).map(frame=>frame.heading!);
 expect(headings.length).toBeGreaterThan(1);expect(Math.max(...headings)-Math.min(...headings)).toBeLessThan(1);
 await expect(page.locator('.clipping-alert')).toHaveCount(0);
});

test('outgoing EPUB snapshot preserves visible text coordinates during chapter loading',async({page})=>{
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'snapshot.epub',mimeType:'application/epub+zip',buffer:illustratedEpub(true,'Snapshot audit',24,false,false,artwork,':root {--section-indent:40px} p {margin-left:var(--section-indent,0px)} @media(max-width:500px){p {padding-top:30px}}')});
 await page.locator('.continue-card').click();await expect(page.locator('.epub-mount iframe')).toBeVisible();
 await page.getByRole('button',{name:'Показать управление чтением'}).click();const slider=page.getByRole('slider',{name:'Прогресс чтения'});await expect(slider).toBeEnabled();await slider.fill('3');await slider.dispatchEvent('pointerup');await expect(slider).toHaveValue('3');await page.getByRole('button',{name:'Скрыть управление чтением'}).click();
 await expect(page.locator('.epub-transition-freeze')).toHaveCount(0);
 const original=await page.locator('.epub-mount').evaluate(host=>{
  const frame=host.querySelector('iframe')!,doc=frame.contentDocument!,origin=frame.getBoundingClientRect(),box=host.getBoundingClientRect();
  return Array.from(doc.querySelectorAll('p,h1,h2')).flatMap(el=>Array.from(el.getClientRects()).map(rect=>({text:el.textContent,left:rect.left+origin.left,top:rect.top+origin.top,right:rect.right+origin.left,bottom:rect.bottom+origin.top}))).filter(r=>r.right>box.left+2&&r.left<box.right-2&&r.bottom>box.top&&r.top<box.bottom).slice(0,8);
 });
 await page.evaluate(async()=>{
  // Load the exact production helper through Vite, with no reader internals.
  const module=await import('/src/reader/epubTransition.ts');
  (window as any).__releaseSnapshot=module.freezeEpubViewport(document.querySelector('.epub-mount'));
 });
 const copy=await page.locator('.epub-mount').evaluate(host=>{
  const box=host.getBoundingClientRect(),root=host.querySelector('.epub-transition-freeze')!.firstElementChild!.shadowRoot!;
  return Array.from(root.querySelectorAll('p,h1,h2')).flatMap(el=>Array.from(el.getClientRects()).map(rect=>({text:el.textContent,left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom}))).filter(r=>r.right>box.left+2&&r.left<box.right-2&&r.bottom>box.top&&r.top<box.bottom).slice(0,8);
 });
 expect(original.length).toBeGreaterThan(0);expect(copy.length).toBe(original.length);
 for(const [i,rect] of original.entries()){
  expect(copy[i].text).toBe(rect.text);
  for(const axis of ['left','top','right','bottom'] as const)expect(Math.abs(copy[i][axis]-rect[axis])).toBeLessThan(1);
 }
 await page.evaluate(()=>(window as any).__releaseSnapshot());
});

test('FB2 picker is unrestricted on iPhone while unsupported imports are rejected',async({page})=>{
 await page.goto('/');const input=page.locator('input[type=file]');expect(await input.getAttribute('accept')).toBeNull();
 await input.setInputFiles({name:'not-a-book.txt',mimeType:'text/plain',buffer:Buffer.from('not a book')});await expect(page.locator('.app-error')).toContainText('Поддерживаются только FB2 и EPUB');
 await page.locator('.app-error').getByRole('button',{name:'Закрыть'}).click();
 await input.setInputFiles({name:'IPHONE.FB2',mimeType:'application/octet-stream',buffer:Buffer.from('<FictionBook><description><title-info><book-title>FB2 из Файлов iPhone</book-title></title-info></description><body><section><p>FB2 открывается и показывает весь текст.</p></section></body></FictionBook>')});
 await page.locator('.continue-card').click();await expect(page.locator('.book-flow')).toContainText('FB2 открывается и показывает весь текст.');
});
