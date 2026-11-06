import {test,expect} from '@playwright/test';
import {epubFixture} from './support/epub-fixture';

const fb2='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Положение панели</book-title></title-info></description><body><section><title><p>Первая глава</p></title>'+('<p>'+('Проверяем неизменность текста на странице. '.repeat(18))+'</p>').repeat(20)+'</section></body></FictionBook>';

async function installMode(page,standalone:boolean){
 await page.addInitScript(({standalone})=>{
  Object.defineProperty(navigator,'standalone',{configurable:true,value:standalone});
 },{standalone});
}
async function open(page,format:string){
 await page.goto('/');
 // A realistic top inset makes the overlay/text separation observable in desktop WebKit.
 await page.addStyleTag({content:':root{--reader-safe-top:59px!important;--reader-safe-bottom:34px!important}'});
 await page.locator('input[type=file]').first().setInputFiles({name:'clearance.'+format,mimeType:format==='fb2'?'application/xml':'application/epub+zip',buffer:format==='fb2'?Buffer.from(fb2):epubFixture(false,'Положение панели EPUB',12)});
 await page.locator('.continue-card').click();
 await expect(page.locator(format==='fb2'?'.book-flow':'.epub-mount iframe')).toBeVisible();
 await expect(page.locator('.reading-status')).toContainText(/\d+ \/ \d+/);
 await page.getByRole('button',{name:'Показать управление чтением'}).click();
 await expect(page.locator('.reading-top')).toHaveClass(/visible/);
}
async function metrics(page,format:string){
 return page.evaluate(format=>{
  const box=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
  const frame=document.querySelector('.epub-mount iframe') as HTMLIFrameElement|null;
  const doc=format==='epub'?frame.contentDocument:document;
  const text=doc.querySelector(format==='epub'?'p':'.book-paragraph');
  const viewport=document.querySelector(format==='epub'?'.epub-mount':'.page-viewport');
  return {viewport:box(viewport),text:box(text),textContent:text.textContent,pageStatus:document.querySelector('.reading-status').textContent,viewportScroll:[viewport.scrollLeft,viewport.scrollTop],frame:frame?box(frame):null};
 },format);
}
for(const format of ['fb2','epub']){
 test(format+': installed iPhone controls move down while book geometry and pages remain identical',async({page})=>{
  await installMode(page,true);await open(page,format);
  await expect(page.locator('html')).toHaveClass(/libra-ios-standalone/);
  const installed=await metrics(page,format);
  await expect(page.locator('.reading-top')).toHaveCSS('top','91px');
  const height=await page.locator('.reading-top').evaluate(el=>el.getBoundingClientRect().height);
  await page.evaluate(()=>document.documentElement.classList.remove('libra-ios-standalone'));
  const original=await metrics(page,format);
  await expect(page.locator('.reading-top')).toHaveCSS('top','67px');
  expect(installed).toEqual(original);
  await page.evaluate(()=>document.documentElement.classList.add('libra-ios-standalone'));
  await expect(page.locator('.reading-top')).toHaveCSS('top','91px');
  expect(await metrics(page,format)).toEqual(original);
  expect(await page.locator('.reading-top').evaluate(el=>el.getBoundingClientRect().height)).toBeCloseTo(height,3);
  await page.getByRole('button',{name:'Цитата',exact:true}).click();
  await expect(page.locator('.quote-mode-tip')).toHaveCSS('top','93px');
  expect(await metrics(page,format)).toEqual(original);
 });
}
test('ordinary iPhone browser keeps the existing toolbar position',async({page})=>{
 await installMode(page,false);await open(page,'fb2');
 await expect(page.locator('html')).not.toHaveClass(/libra-ios-standalone/);
 await expect(page.locator('.reading-top')).toHaveCSS('top','67px');
});
test('a non-iPhone standalone app keeps its existing toolbar position',async({page})=>{
 await installMode(page,true);
 await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36'}));
 await open(page,'fb2');
 await expect(page.locator('html')).not.toHaveClass(/libra-ios-standalone/);
 await expect(page.locator('.reading-top')).toHaveCSS('top','67px');
});
