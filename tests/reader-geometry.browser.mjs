import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
const shortFixedViewport=process.env.SHORT_FIXED_VIEWPORT==='1';
const installed=process.env.INSTALLED_APP==='1';
const staleInnerHeight=process.env.STALE_INNER_HEIGHT==='1';
const brokenViewportUnits=process.env.BROKEN_DVH==='1';
const root=fileURLToPath(new URL('../docs/',import.meta.url));
try{
 const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,serviceWorkers:'block'});
 await page.addInitScript(()=>Object.defineProperty(document,'fullscreenEnabled',{value:false}));
 if(staleInnerHeight)await page.addInitScript(()=>{const viewportHeight=Object.getOwnPropertyDescriptor(window,'innerHeight').get.bind(window);Object.defineProperty(navigator,'userAgent',{value:'iPhone'});Object.defineProperty(window,'innerHeight',{get:()=>viewportHeight()-74});Object.defineProperty(screen,'width',{value:393});Object.defineProperty(screen,'height',{get:()=>viewportHeight()});});
 if(installed)await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));
 await page.route('https://reader.test/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/empty')return route.fulfill({contentType:'text/html',body:'<html></html>'});
  const rel=path.replace(/^\/kniga-reader\//,'')||'index.html';let body=readFileSync(root+rel,'utf8');
  if(rel.endsWith('.css')&&brokenViewportUnits)body=body.replaceAll('100dvh','803px').replaceAll('100svh','803px');
  if(rel.endsWith('.css'))body=body.replace(/env\(safe-area-inset-(top|bottom)(?:,\s*0px)?\)/g,(_,edge)=>`var(--test-${edge},0px)`);
  if(rel==='index.html')body=body.replace('<head>','<head><style>:root{--test-top:59px;--test-bottom:34px}</style>');
  return route.fulfill({body,contentType:rel.endsWith('.js')?'text/javascript':rel.endsWith('.css')?'text/css':'text/html'});
 });
 await page.route('https://qwnkigorqsgugcctnfmj.supabase.co/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{"message":"guest"}'}));
 await page.goto('https://reader.test/empty');
 await page.evaluate(async()=>{
  const text='Все это я объяснил Стену Уолкеру после получения его письма. К моему удивлению, он взял свои возражения назад и попросил меня прислать ему побольше информации относительно психологической травмы у детей. Я написал ему, что, к сожалению, в настоящее время на эту тему написано не так много. '.repeat(4);
  const caption='Рис. 3. Континуум возбуждения, зависимость обучения от психического состояния и реакция на угрозу';
  const blocks=[{type:'p',text:caption,html:'<em>'+caption+'</em>'},...Array.from({length:20},()=>({type:'p',text,html:text}))];
  await new Promise((resolve,reject)=>{const r=indexedDB.open('kniga-reader',1);r.onupgradeneeded=()=>{r.result.createObjectStore('books',{keyPath:'id'});r.result.createObjectStore('preferences');};r.onsuccess=()=>{const db=r.result,tx=db.transaction(['books','preferences'],'readwrite');tx.objectStore('books').put({id:'test',title:'Геометрия страницы',author:'Тест',blocks,presentationVersion:1,chars:blocks.reduce((n,b)=>n+b.text.length,0),chapters:[],fileName:'test.fb2',addedAt:1,marks:[]});tx.objectStore('preferences').put({font:'sans',fontSize:22,lineHeight:1.1,margin:8,indent:1.3,paragraphGap:0,paragraphSpacingVersion:1,letterSpacing:0,align:'justify',hyphens:true,theme:'night'},'settings');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=reject;};});
 });
 await page.goto('https://reader.test/kniga-reader/');if(shortFixedViewport)await page.addStyleTag({content:'body.reading{bottom:64px}'});await page.locator('[data-book="test"]').click();await page.locator('.book-page[aria-hidden="false"] .book-text').waitFor();
 await page.waitForFunction(()=>document.querySelector('#book-stage')?.dataset.layoutState==='ready'&&document.querySelector('#book-stage')?.dataset.paginationComplete==='true');
 const pages=[];
 const pageCount=Number((await page.locator('#reader-page-position').textContent()).match(/из\s+(\d+)/)?.[1]||0);
 assert.ok(pageCount>=2,'fixture must span multiple pages for page-boundary checks');
 const testedPages=Math.min(pageCount,6);
 for(let i=0;i<testedPages;i++){
  pages.push(await page.evaluate(()=>{
   const page=document.querySelector('.book-page[aria-hidden="false"]'),text=page.querySelector('.book-text'),reader=document.querySelector('.reader'),stage=document.querySelector('#book-stage');
   const range=document.createRange();range.selectNodeContents(text);const rects=[...range.getClientRects()].filter(r=>r.height>2&&r.width>1),bounds=stage.getBoundingClientRect();
   const first=Math.min(...rects.map(r=>r.top)),last=Math.max(...rects.map(r=>r.bottom));
   return {position:document.querySelector('#reader-page-position').textContent,stageTop:bounds.top,stageBottom:bounds.bottom,allVisible:rects.every(r=>r.left>=bounds.left-.05&&r.right<=bounds.right+.05&&r.top>=bounds.top-.05&&r.bottom<=bounds.bottom+.05&&r.bottom<=window.innerHeight+.05),stageHeight:stage.clientHeight,pageHeight:page.clientHeight,readerHeight:reader.clientHeight,first,last,unused:bounds.bottom-last,lineHeight:parseFloat(getComputedStyle(text).lineHeight),padding:getComputedStyle(text).padding,transform:getComputedStyle(page).transform,clip:getComputedStyle(page).clipPath,pageY:page.getBoundingClientRect().y};
  }));
  if(!i)await page.screenshot({path:'/tmp/kniga-viewport-review.png'});
  if(i===testedPages-1)break;
  const before=await page.locator('#reader-page-position').textContent();
  await page.locator('#book-stage').tap({position:{x:360,y:220}});
  try{await page.waitForFunction(before=>document.querySelector('#reader-page-position').textContent!==before,before,{timeout:10000});}
  catch(error){console.error('Page-turn diagnostics',await page.evaluate(()=>({stage:document.querySelector('#book-stage')?.dataset.layoutState,loading:document.querySelector('#page-loading')?.textContent,loadingHidden:document.querySelector('#page-loading')?.hidden,position:document.querySelector('#reader-page-position')?.textContent,activeElement:document.activeElement?.tagName,readerClass:document.querySelector('.reader')?.className})));throw error;}
 }
 console.log(JSON.stringify(pages,null,2));
 assert.ok(pages.every(p=>p.readerHeight===852),'installed reader must fill its actual window even when dynamic viewport units are too short');
 // Showing the chrome must only paint overlays; the book cannot be repaginated.
 const readingSnapshot=()=>page.evaluate(()=>{
  const stage=document.querySelector('#book-stage'),text=document.querySelector('.book-page[aria-hidden="false"] .book-text');
  return {width:stage.clientWidth,height:stage.clientHeight,layout:stage.dataset.layoutState,page:document.querySelector('#reader-page-position').textContent,markup:text.innerHTML,source:text.textContent,bookPages:document.querySelectorAll('.book-page').length,ariaBusy:stage.getAttribute('aria-busy')};
 });
 const beforeChrome=await readingSnapshot();
 const assertUnchangedChrome=async()=>assert.deepEqual(await readingSnapshot(),beforeChrome,
  'opening and hiding the floating chrome must never repaginate, change source text or show a loading state');
 const originalAnchor=await page.evaluate(()=>{const fragment=document.querySelector('.book-page[aria-hidden="false"] [data-block]');return {block:Number(fragment.dataset.block),offset:Number(fragment.dataset.from)};});
 const assertAnchorPresent=async()=>{
  await page.waitForFunction(()=>document.querySelector('#book-stage')?.dataset.layoutState==='ready'&&document.querySelector('#book-stage')?.dataset.paginationComplete==='true');
  const found=await page.evaluate(anchor=>[...document.querySelectorAll('.book-page[aria-hidden="false"] [data-block]')].some(fragment=>Number(fragment.dataset.block)===anchor.block&&Number(fragment.dataset.from)<=anchor.offset&&Number(fragment.dataset.to)>=anchor.offset),originalAnchor);
  assert.ok(found,'reflow must keep the reader at the original source anchor without skipping text');
 };
 await page.locator('#book-stage').tap({position:{x:190,y:300}});
 await assertUnchangedChrome();
 assert.ok(await page.locator('.reader-footer').isVisible(),'floating toolbar opens on top of the existing page');
 assert.ok(await page.locator('.reader-header').isVisible(),'floating header opens without shifting book text');
 const footer=await page.locator('.reader-footer').boundingBox();
 assert.ok(footer.width>=368&&footer.height>=111,'floating controls should be visibly larger without exceeding iPhone width');
 assert.ok(footer.x>=7&&footer.x+footer.width<=393-7,'larger toolbar retains horizontal tap margins');
 assert.ok(footer.y+footer.height<=852&&footer.y+footer.height>=852-60,'the visible control panel must fit above the home indicator');
 await assertAnchorPresent();
 const controlsBottom=staleInnerHeight?778:852;
 for(const button of await page.locator('.reader-tools button:visible').all()){const bounds=await button.boundingBox();assert.ok(bounds&&bounds.y+bounds.height<=controlsBottom, 'every visible control must fit inside the interactive viewport');}
 await page.locator('#appearance').click();await page.locator('dialog[open]').waitFor();await assertUnchangedChrome();
 await page.locator('#close-sheet').click();await assertUnchangedChrome();
 await page.locator('#book-stage').tap({position:{x:190,y:300}});
 await assertUnchangedChrome();
 assert.equal(await page.locator('.reader-footer').isVisible(),false,'hiding the toolbar does not change the page');
 await page.locator('#book-stage').tap({position:{x:190,y:300}});
 await assertUnchangedChrome();
 await page.screenshot({path:'/tmp/kniga-pwa-controls.png'});
 const session=await page.context().newCDPSession(page);
 await session.send('Emulation.setDeviceMetricsOverride',{width:393,height:900,deviceScaleFactor:1,mobile:false});
 await page.waitForFunction(()=>document.querySelector('.reader').clientHeight===900);
 await page.waitForFunction(()=>document.querySelector('#book-stage')?.dataset.layoutState==='ready'&&document.querySelector('#book-stage')?.dataset.paginationComplete==='true');
 await assertAnchorPresent();
 const resizedFooter=await page.locator('.reader-footer').boundingBox();
 assert.ok(resizedFooter.y+resizedFooter.height<=900&&resizedFooter.y+resizedFooter.height>=900-60,'controls follow window size changes and respect the home indicator');
 assert.ok(pages.every(p=>p.stageTop>=63&&p.stageTop<=64),'installed page starts just below the iOS safe area');
 assert.ok(pages.every(p=>p.stageBottom>=837&&p.stageBottom<=838),'reading area may use only the remaining safe pixels below without clipping');
 assert.ok(pages.every(p=>p.stageHeight>=769),'pagination must receive the reclaimed bottom pixels');
 assert.ok(pages.every(p=>p.first>=63&&p.first<=71),'first text line must be fully below the translucent iOS top edge');
 assert.ok(pages.every(p=>p.allVisible),'all rendered text rectangles must fit within the current stage and screen');
 assert.ok(pages.slice(0,-1).every(p=>p.unused<=p.lineHeight+4),'continued text should fill the page; the book final page may end early');
}finally{await browser.close();}
