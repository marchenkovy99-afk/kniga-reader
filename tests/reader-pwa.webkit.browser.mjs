// WebKit's rendering engine approximates iOS Safari, but Linux WebKit is not a physical iPhone.
// Safe-area insets and navigator.standalone are injected explicitly to exercise the installed PWA layout.
import {readFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const {webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dist=fileURLToPath(new URL('../docs/',import.meta.url));
const output=fileURLToPath(new URL('../test-results/pwa/',import.meta.url));
mkdirSync(output,{recursive:true});
const browser=await webkit.launch({headless:true});
const longText='Мы измеряем точную высоту строки, сохраняем каждое слово и проверяем перенос текста на следующую страницу. ';
const blockText=longText.repeat(19);
const lengths=[1874,1233,689,442,1641,213,1343,823,1532,481,1698,932,359,1782,574,1150];
const blocks=lengths.map((n,i)=>{const text=blockText.slice(0,n);return {type:'p',text,html:text};});

async function exerciseInstalledReader({width,height,top=59,bottom=34,visualShrink=0,innerShrink=0,documentShrink=0}) {
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:3,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>true});
 });
 if(innerShrink)await page.addInitScript(delta=>{
  const initial=window.innerHeight;
  Object.defineProperty(window,'innerHeight',{configurable:true,get:()=>Math.max(1,(document.documentElement?.clientHeight||initial)-delta)});
 },innerShrink);
 if(visualShrink)await page.addInitScript(delta=>{
  const viewport=window.visualViewport;
  let proto=viewport,originalGetter;
  while(proto&&!originalGetter){
   originalGetter=Object.getOwnPropertyDescriptor(proto,'height')?.get;
   proto=Object.getPrototypeOf(proto);
  }
  if(!originalGetter)throw new Error('VisualViewport height getter is unavailable for PWA test');
  Object.defineProperty(viewport,'height',{configurable:true,get:()=>Math.max(1,originalGetter.call(viewport)-delta)});
 },visualShrink);
 await page.route('https://reader.test/**',route=>{
  const pathname=new URL(route.request().url()).pathname;
  if(pathname==='/empty')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body></body></html>'});
  const relative=pathname.replace(/^\/kniga-reader\//,'')||'index.html';
  const filename=path.join(dist,relative);
  if(!filename.startsWith(dist))return route.abort();
  if(/\.(png|jpg|jpeg|ico|webp)$/.test(relative))return route.fulfill({body:readFileSync(filename),contentType:'image/png'});
  let body=readFileSync(filename,'utf8');
  if(relative.endsWith('.css')){
   body=body.replace(/env\(safe-area-inset-(top|bottom)(?:,\s*0px)?\)/g,(_,edge)=>'var(--test-'+edge+',0px)');
  }
  if(relative==='index.html'){
   body=body.replace('<head>', '<head><style>:root{--test-top:'+top+'px;--test-bottom:'+bottom+'px}</style>');
  }
  const contentType=relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.webmanifest')?'application/manifest+json':'text/html';
  return route.fulfill({body,contentType});
 });
 await page.route('https://qwnkigorqsgugcctnfmj.supabase.co/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"guest"}'}));
 try{
  await page.goto('https://reader.test/empty');
  await page.evaluate(async input=>{
   const chars=input.reduce((n,b)=>n+b.text.length,0);
   await new Promise((resolve,reject)=>{
    const request=indexedDB.open('kniga-reader',1);
    request.onupgradeneeded=()=>{
     const db=request.result;
     if(!db.objectStoreNames.contains('books'))db.createObjectStore('books',{keyPath:'id'});
     if(!db.objectStoreNames.contains('preferences'))db.createObjectStore('preferences');
    };
    request.onsuccess=()=>{
     const db=request.result,tx=db.transaction(['books','preferences'],'readwrite');
     tx.objectStore('books').put({id:'pwa-fixture',title:'PWA: полный текст страниц',author:'Автотест',blocks:input,presentationVersion:1,chars,chapters:[],fileName:'pwa.fb2',addedAt:1,marks:[]});
     tx.objectStore('preferences').put({font:'sans',fontSize:22,lineHeight:1.1,margin:8,indent:1.3,paragraphGap:0,paragraphSpacingVersion:1,letterSpacing:0,align:'justify',hyphens:true,theme:'night'},'settings');
     tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
    };
    request.onerror=()=>reject(request.error);
   });
  },blocks);
  await page.goto('https://reader.test/kniga-reader/');
  if(documentShrink)await page.evaluate(delta=>{
   const node=document.documentElement;
   const proto=Object.getPrototypeOf(node);
   const original=Object.getOwnPropertyDescriptor(proto,'clientHeight')?.get;
   const cssHeight=original?original.call(node):window.innerHeight;
   Object.defineProperty(node,'clientHeight',{configurable:true,get:()=>Math.max(1,cssHeight-delta)});
  },documentShrink);
  const metadata=await page.evaluate(()=>({
   capable:document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
   viewport:document.querySelector('meta[name="viewport"]')?.content,
   manifest:document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
   standalone:navigator.standalone
  }));
  assert.equal(metadata.capable,'yes','iPhone Home Screen support is required');
  assert.match(metadata.viewport,/viewport-fit=cover/,'the installed iOS layout must expose safe-area insets');
  assert.ok(metadata.manifest,'PWA manifest must be linked');
  assert.equal(metadata.standalone,true,'test must be running with simulated standalone mode');
  await page.locator('[data-book="pwa-fixture"]').click();
  if(visualShrink||innerShrink||documentShrink){
   const measurements=await page.evaluate(()=>({inner:innerHeight,visual:visualViewport.height,layout:document.documentElement.clientHeight}));
   if(innerShrink&&!documentShrink)assert.ok(measurements.layout-measurements.inner>=innerShrink-2,'test must reproduce stale JS height relative to CSS viewport');
   if(documentShrink)assert.ok(height-measurements.layout>=documentShrink-2,'test must reproduce stale document clientHeight despite a full CSS viewport');
   if(visualShrink)assert.ok(height-measurements.visual>=visualShrink-2,'test must reproduce stale visualViewport relative to the actual CSS viewport');
  }
  await page.waitForFunction(()=>document.querySelector('#book-stage')?.dataset.layoutState==='ready'&&document.querySelector('#book-stage')?.dataset.paginationComplete==='true',{timeout:40000});
  const pageCount=Number((await page.locator('#reader-page-position').textContent()).match(/из\s+(\d+)/)?.[1]||0);
  assert.ok(pageCount>=4,'fixture must have several pages');
  const samples=[];
  for(let i=0;i<Math.min(10,pageCount);i++){
   const reading=await page.evaluate(()=>{
    const stage=document.querySelector('#book-stage');
    const page=document.querySelector('.book-page[aria-hidden="false"]');
    const text=page?.querySelector('.book-text');
    if(!stage||!page||!text)return null;
    const viewport=stage.getBoundingClientRect(),bounds=page.getBoundingClientRect();
    const range=document.createRange();range.selectNodeContents(text);
    const glyphs=[...range.getClientRects()].filter(rect=>rect.height>2&&rect.width>1);
    const fits=glyphs.every(r=>r.top>=viewport.top-.05&&r.bottom<=viewport.bottom+.05&&r.left>=viewport.left-.05&&r.right<=viewport.right+.05);
    const markers=[...text.querySelectorAll('[data-block]')].map(x=>({block:Number(x.dataset.block),from:Number(x.dataset.from),to:Number(x.dataset.to)}));
    return {stage:{top:viewport.top,bottom:viewport.bottom,height:viewport.height},page:{top:bounds.top,bottom:bounds.bottom},first:Math.min(...glyphs.map(x=>x.top)),last:Math.max(...glyphs.map(x=>x.bottom)),glyphs:glyphs.length,fits,markers,pageText:text.textContent,position:document.querySelector('#reader-page-position').textContent,ready:stage.dataset.layoutState};
   });
   assert.ok(reading,'rendered page must exist');
   assert.equal(reading.ready,'ready','book must be visible, not in an error state');
   assert.ok(reading.glyphs>0&&reading.fits,'all text rectangles must fit within installed PWA stage');
   assert.ok(reading.first>=top+16&&reading.first<=top+24,'first line must stay close to, and below, the iOS safe area');
   assert.ok(reading.stage.bottom<=height+0.1&&Math.abs(reading.stage.bottom-(height-Math.max(10,bottom-24)))<=1,'last line must remain on-screen');
   assert.ok(reading.page.bottom<=reading.stage.bottom+1,'flipbook page cannot extend beyond its clipping stage');
   assert.ok(reading.last<=reading.stage.bottom,'last glyph must not be cropped');
   if(samples.length){
    const previous=samples.at(-1).markers.at(-1),next=reading.markers[0];
    assert.ok(next.block===previous.block?next.from===previous.to:next.block===previous.block+1&&next.from===0,'source anchor must continue without missing or duplicating characters');
   }
   samples.push(reading);
   if(i===0)await page.screenshot({path:path.join(output,'webkit-'+width+'x'+height+'-reading.png')});
   if(i<Math.min(10,pageCount)-1){
    const before=reading.position;
    await page.locator('#book-stage').tap({position:{x:width-30,y:Math.min(270,height/3)}});
    await page.waitForFunction(previous=>document.querySelector('#reader-page-position')?.textContent!==previous,before,{timeout:12000});
   }
  }
  const density=await page.evaluate(()=>{const text=document.querySelector('.book-page[aria-hidden="false"] .book-text');return parseFloat(getComputedStyle(text).lineHeight);});
  for(const sample of samples){
   const unused=sample.stage.bottom-sample.last;
   const isFinal=sample.position.endsWith('из '+pageCount);
   assert.ok(isFinal||unused<=density+7,
    'ordinary prose must not leave two or more usable lines unfilled: '+JSON.stringify({position:sample.position,unused,density,start:sample.markers[0],end:sample.markers.at(-1)}));
  }
  console.log('PWA_PAGE_DENSITY',width+'x'+height,JSON.stringify(samples.map(s=>({position:s.position,unused:Math.round((s.stage.bottom-s.last)*10)/10,end:s.markers.at(-1),start:s.markers[0]}))));
  const bar=page.locator('.reader-header');
  assert.equal(await bar.isVisible(),false,'reading must not waste vertical space on a persistent black toolbar');
  const metaStyle=await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content');
  assert.equal(metaStyle,'black','opaque status bar disables the translucent iOS system blur');
  const immersiveNumber=page.locator('#reader-bottom-page-number');
  assert.equal(await immersiveNumber.isVisible(),true,'page number stays visible with reading controls hidden');
  assert.equal(await bar.isVisible(),false,'top navigation is hidden while reading');
  assert.equal(await immersiveNumber.textContent(),await page.locator('#reader-page-position').textContent(),'immersive page number tracks current page');
  const numberPosition=await immersiveNumber.boundingBox();
  assert.ok(numberPosition&&numberPosition.y>=samples[0].stage.bottom&&numberPosition.y<height,'immersive number must be below text and remain on-screen');
  const snapshot=()=>page.evaluate(()=>{
   const stage=document.querySelector('#book-stage'),active=document.querySelector('.book-page[aria-hidden="false"] .book-text');
   return {height:stage.clientHeight,width:stage.clientWidth,ready:stage.dataset.layoutState,html:active.innerHTML,source:active.textContent,count:document.querySelectorAll('.book-page').length,number:document.querySelector('#reader-page-position').textContent};
  });
  const before=await snapshot();
  await page.locator('#book-stage').tap({position:{x:Math.floor(width/2),y:Math.floor(height/3)}});
  assert.equal(await page.locator('.reader-footer').isVisible(),true,'floating controls open over text');
  assert.equal(await bar.isVisible(),true,'top arrows and bookmark appear only when controls are opened');
  for(const id of ['prev-page','next-page','toggle-bookmark'])assert.equal(await page.locator('#'+id).isVisible(),true,'top navigation control '+id);
  assert.equal(await immersiveNumber.isVisible(),false,'immersive counter must not duplicate the toolbar counter');
  assert.deepEqual(await snapshot(),before,'opening controls must not repaginate');
  const footer=await page.locator('.reader-footer').boundingBox();
  assert.ok(footer.x>=0&&footer.x+footer.width<=width+.5&&footer.y>=0&&footer.y+footer.height<=height,'toolbar stays within installed window');
  const chromeBottomGap=height-footer.y-footer.height;
  assert.ok(chromeBottomGap>=8&&chromeBottomGap<=24,
   'PWA controls should sit close to the screen bottom without entering the home gesture strip; gap='+chromeBottomGap);
  // On-device diagnostics must be readable and must not change source or pagination.
  await page.evaluate(()=>{for(let i=0;i<5;i++)document.querySelector('#reader-page-position').click();});
  await page.locator('.reader-geometry-overlay').waitFor();
  const diagnostics=await page.locator('.reader-geometry-sheet textarea').inputValue();
  assert.match(diagnostics,/Границы страницы:/,'on-device diagnostics must include actual stage bounds');
  assert.match(diagnostics,/Последняя строка:/,'on-device diagnostics must report final visible text glyph');
  assert.match(diagnostics,/Граница листа: \d+/,'on-device report must distinguish actual flipbook sheet clipping from stage bounds');
  assert.doesNotMatch(diagnostics,/Мы измеряем точную высоту строки|PWA: полный текст страниц/i,'report must not disclose book content or title');
  assert.deepEqual(await snapshot(),before,'opening diagnostic report cannot repaginate the book');
  await page.screenshot({path:path.join(output,'webkit-'+width+'x'+height+'-diagnostics.png')});
  await page.locator('.reader-geometry-actions button').last().click();
  assert.deepEqual(await snapshot(),before,'closing diagnostics cannot repaginate the book');
  await page.screenshot({path:path.join(output,'webkit-'+width+'x'+height+'-controls.png')});
  await page.locator('#appearance').click();
  await page.locator('dialog[open]').waitFor();
  assert.deepEqual(await snapshot(),before,'appearance sheet must not silently change page');
  await page.locator('#close-sheet').click();
  assert.deepEqual(await snapshot(),before,'closing appearance sheet must not repaginate');
  // iOS standalone may temporarily report a smaller visual reading window.
  // Controls remain anchored to the device viewport, not the reader container.
  await page.evaluate(h=>{document.body.style.setProperty('height',h+'px','important');},height-54);
  const shortenedFooter=await page.locator('.reader-footer').boundingBox();
  assert.ok(Math.abs(shortenedFooter.y+shortenedFooter.height-(footer.y+footer.height))<=1,
   'shrinking the reading container must not pull the floating toolbar upward');
  await page.evaluate(()=>document.body.style.removeProperty('height'));
  await page.reload();
  await page.locator('[data-book="pwa-fixture"]').click();
  await page.waitForFunction(()=>document.querySelector('#book-stage')?.dataset.layoutState==='ready'&&document.querySelector('#book-stage')?.dataset.paginationComplete==='true',{timeout:40000});
  assert.ok((await page.locator('.book-page[aria-hidden="false"] .book-text').textContent()).length>0,'book must reopen after a standalone reload');
  assert.equal(errors.length,0,'no uncaught JavaScript errors during installed reader session: '+errors.join('; '));
  console.log('WebKit PWA',width+'x'+height+(visualShrink?'-visual-minus-'+visualShrink:'')+(innerShrink?'-inner-minus-'+innerShrink:'')+(documentShrink?'-document-minus-'+documentShrink:''),JSON.stringify({pages:pageCount,first:samples[0].first,last:samples[0].last,stage:samples[0].stage,toolbar:{width:footer.width,height:footer.height},reopened:true}));
 }finally{
  await context.close();
 }
}
try{
 const manifest=JSON.parse(readFileSync(path.join(dist,'manifest.webmanifest'),'utf8'));
 assert.equal(manifest.display,'standalone','PWA must use the same standalone launch mode as iOS Home Screen');
 assert.ok(!manifest.display_override?.includes('fullscreen'),'PWA display override must not change its fullscreen/status-bar geometry');
 assert.match(manifest.start_url,/^\.\//,'start URL should stay in the PWA scope');
 for(const screen of [{width:393,height:852},{width:375,height:812},{width:430,height:932},{width:393,height:852,visualShrink:74},{width:393,height:852,innerShrink:74},{width:393,height:852,visualShrink:74,innerShrink:74,documentShrink:74}]){
  await exerciseInstalledReader(screen);
 }
 console.log('WebKit standalone PWA regression passed: reading integrity, safe areas, controls, reload.');
}finally{await browser.close();}
