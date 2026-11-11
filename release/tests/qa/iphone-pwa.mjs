// Linux WebKit + iPhone emulation is not a physical installed iPhone PWA.
// Record rendering observations without certifying hardware frame pacing.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {webkit,chromium,devices}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base=new URL(process.env.BASE_URL);
assert.equal(base.protocol,'https:');
assert.match(base.hostname,/^libra-standalone-preview(?:-[a-z0-9]+-marchenkovy99-3693)?\.vercel\.app$/);
const output='test-results/iphone-pwa';mkdirSync(output,{recursive:true});
const reports=[];
const prose='<p>'+('Тихий вечер опустился на город. Читатель перевернул страницу. '.repeat(18))+'</p>';
const phrase='<p>Руко<emphasis>писи</emphasis> не горят. Это предложение для поиска.</p>';
const fb2=`<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>PWA QA FB2</book-title></title-info></description><body><section><title><p>Первая глава</p></title>${prose.repeat(85)}${phrase}${prose.repeat(10)}</section><section><title><p>Вторая глава</p></title>${phrase}${prose.repeat(20)}</section></body></FictionBook>`;
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];

for(const [name,type] of [['webkit',webkit],['chromium',chromium]]){
 const report={engine:name,environment:'Linux headless, iPhone 13 context, simulated navigator.standalone',physicalIPhone:false,checks:[],errors:[],metrics:{}};reports.push(report);
 const browser=await type.launch({headless:true});
 const context=await browser.newContext({...devices['iPhone 13'],serviceWorkers:'allow',reducedMotion:'no-preference'});
 await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>true}));
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
 const check=(condition,label)=>{assert.ok(condition,label);report.checks.push(label);};
 const waitBook=async()=>{await page.locator('.reading-root').waitFor();await page.waitForFunction(()=>{const view=document.querySelector('.reading-content .page-viewport,.reading-content .epub-mount');return view?.libraFb2Preview?.settled?.()||!!view?.libraEpubPreview?.position?.()?.cfi;});};
 const status=()=>page.locator('.reading-status').textContent();
 const controls=async()=>{if(!await page.locator('.reading-top').evaluate(el=>el.classList.contains('visible')))await page.getByRole('button',{name:'Показать управление чтением',exact:true}).tap();await page.getByRole('button',{name:'Поиск по книге',exact:true}).waitFor({state:'visible'});};
 const goLibrary=async()=>{await controls();await page.getByRole('button',{name:'В библиотеку',exact:true}).tap();await page.locator('.library-header').waitFor();};
 const search=async()=>{await controls();await page.getByRole('button',{name:'Поиск по книге',exact:true}).tap();await page.getByLabel('Слово, фраза или предложение',{exact:true}).fill('рукописи не горят');await page.getByRole('button',{name:'Перейти к совпадению 2',exact:true}).waitFor();};
 try{
  const release=await (await context.request.get(new URL('/release.json',base).href)).json();
  check(release.offlineBuild==='f18e72ccc5f21870','correct modified offline build');
  report.release=release;await page.goto(base.href);await page.locator('input[type=file]').waitFor({state:'attached'});
  const meta=await page.evaluate(()=>({standalone:navigator.standalone,capable:document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,viewport:document.querySelector('meta[name="viewport"]')?.content}));
  check(meta.standalone&&meta.capable==='yes'&&meta.viewport.includes('viewport-fit=cover'),'standalone and viewport metadata');
  const manifest=await (await context.request.get(new URL('/manifest.webmanifest',base).href)).json();check(manifest.display==='standalone','manifest standalone display');
  await page.locator('input[type=file]').setInputFiles({name:'pwa-qa.fb2',mimeType:'application/xml',buffer:Buffer.from(fb2)});
  await page.locator('[data-library-book] .book-tile-open').filter({hasText:'PWA QA FB2'}).tap();await waitBook();check(true,'FB2 import and open');
  const taps=[];
  for(let i=0;i<30;i++){
   const before=await status(),box=await page.locator('.reading-zones').boundingBox();const start=Date.now();
   await page.touchscreen.tap(box.x+box.width*.9,box.y+box.height*.45);
   await page.waitForFunction(previous=>document.querySelector('.reading-status')?.textContent!==previous,before);
   await page.waitForFunction(()=>!document.querySelector('[data-libra-page-turn][data-active]'));
   taps.push(Date.now()-start);
  }
  report.metrics.edgeTaps={count:taps.length,p95Ms:p95(taps),maximumMs:Math.max(...taps),samplesMs:taps,measurement:'Playwright call to committed DOM, includes harness overhead'};
  check(true,'30 mobile edge taps commit without stuck visual planes');
  const original=await status();await search();check(await page.locator('.book-search-result').count()===2,'FB2 cross-formatting phrase matches');
  await page.getByRole('button',{name:'Перейти к совпадению 2',exact:true}).tap();await page.getByText('2 / 2',{exact:true}).waitFor();
  const viewport=()=>page.locator('.reading-content .page-viewport').evaluate(el=>({width:el.clientWidth,height:el.clientHeight}));
  const size=await viewport(),selected=await status();await page.getByRole('button',{name:'Завершить поиск',exact:true}).tap();await page.locator('.book-search-nav').waitFor({state:'detached'});
  check((await status())===selected,'Close preserves selected FB2 position');check(JSON.stringify(await viewport())===JSON.stringify(size),'search overlay does not repaginate');
  await goLibrary();await page.locator('[data-library-book] .book-tile-open').filter({hasText:'PWA QA FB2'}).tap();await waitBook();check((await status())===selected,'FB2 position persists after exit and reopen');
  await search();await page.getByRole('button',{name:'Перейти к совпадению 1',exact:true}).tap();await page.getByText('1 / 2',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Вернуться к исходному месту',exact:true}).tap();await page.locator('.book-search-nav').waitFor({state:'detached'});check((await status())===selected,'explicit FB2 Return restores origin');

  await page.waitForTimeout(250);
  report.metrics.syntheticSwipe=await page.evaluate(async()=>{
   const zone=document.querySelector('.reading-zones'),box=zone.getBoundingClientRect();const intervals=[];let previous;
   const emit=(type,x)=>{const p={identifier:1,clientX:x,clientY:box.top+box.height*.45,target:zone};const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{touches:{value:type==='touchend'?[]:[p]},changedTouches:{value:[p]}});zone.dispatchEvent(e);};
   const x=box.left+box.width*.8;emit('touchstart',x);
   for(let i=0;i<60;i++){await new Promise(resolve=>requestAnimationFrame(t=>{if(previous!==undefined)intervals.push(t-previous);previous=t;emit('touchmove',x-box.width*.6*(i/59));resolve();}));}
   emit('touchend',x-box.width*.6);
   return {frames:intervals.length,maxIntervalMs:Math.max(...intervals),over25Ms:intervals.filter(x=>x>25).length,intervalsMs:intervals,measurement:'synthetic touch events in virtual headless renderer; not physical finger tracking'};
  });
  await page.waitForFunction(()=>!document.querySelector('[data-libra-page-turn][data-active]'));
  await page.screenshot({path:`${output}/${name}-reader.png`});

  await goLibrary();await page.locator('input[type=file]').setInputFiles({name:'pwa-qa.epub',mimeType:'application/epub+zip',buffer:readFileSync('release/tests/browser/search-fixture.epub')});
  await page.locator('[data-library-book] .book-tile-open').filter({hasText:'Проверка поиска EPUB'}).tap();await waitBook();check(true,'EPUB import and open');
  const epubOrigin=await status();await search();check(await page.locator('.book-search-result').count()===2,'EPUB phrase matches');
  await page.getByRole('button',{name:'Перейти к совпадению 2',exact:true}).tap();await page.getByText('2 / 2',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Вернуться к исходному месту',exact:true}).tap();await page.locator('.book-search-nav').waitFor({state:'detached'});check((await status())===epubOrigin,'EPUB explicit Return restores origin');

  await goLibrary();await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.locator('input[type=file]').waitFor({state:'attached'});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload();await page.locator('[data-library-book] .book-tile-open').filter({hasText:'PWA QA FB2'}).tap();await waitBook();
  check(true,'service-worker offline restart and local FB2 reading');await search();check(await page.locator('.book-search-result').count()===2,'offline in-book search');await context.setOffline(false);
  report.status='PASS';
 }catch(error){report.status='FAIL';report.failure=error.stack;try{await page.screenshot({path:`${output}/${name}-failure.png`});}catch{}}
 finally{await context.close();await browser.close();writeFileSync(`${output}/results.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(report));}
}
if(reports.some(r=>r.status!=='PASS'))process.exitCode=1;
