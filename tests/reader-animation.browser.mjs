// Build Pages first, then run with Playwright installed.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../docs/',import.meta.url));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const user={id:'11111111-1111-4111-8111-111111111111',email:'sync@example.test',role:'authenticated',aud:'authenticated'};
const id='a'.repeat(64),states=[],writes=[];
const appearance={fontSize:23,lineHeight:1,margin:8,paragraphGap:0,paragraphSpacingVersion:1,indent:1.3,letterSpacing:0,font:'serif',theme:'night',align:'justify',hyphens:true,animation:true};
const remote=[{user_id:user.id,device_id:'22222222-2222-4222-8222-222222222222',key:'settings',payload:appearance,client_updated_at:200},{user_id:user.id,device_id:'22222222-2222-4222-8222-222222222222',key:'position:'+id,payload:{anchor:{block:47,offset:4},marks:[]},client_updated_at:300}];
let release;const gate=new Promise(r=>release=r);
try{
 const context=await browser.newContext({viewport:{width:393,height:852},hasTouch:true,serviceWorkers:'block'});
 await context.route('https://reader.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/empty')return route.fulfill({contentType:'text/html',body:'<html></html>'});
  try{const rel=path.replace(/^\/kniga-reader\//,'')||'index.html';await route.fulfill({body:readFileSync(root+rel),contentType:rel.endsWith('.js')?'text/javascript':rel.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:'missing'});}
 });
 await context.route('https://qwnkigorqsgugcctnfmj.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  const json=body=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  if(path==='/auth/v1/user')return json(user);
  if(req.method()==='POST'){const record=req.postDataJSON();writes.push(record);return json(null);}
  if(path.includes('kniga_states')){await gate;return json(remote);}
  if(path.includes('kniga_books')){await gate;return json([{id,file_name:'test.txt',size_bytes:100}]);}
  return route.fulfill({status:500,body:'Unexpected '+path});
 });
 const requests=[];
 const page=await context.newPage();page.on('request',r=>{if(r.method()==='GET'&&/\/rest\/v1\/(kniga_states|kniga_books)/.test(r.url()))requests.push(r.url());});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://reader.test/empty');
 await page.evaluate(async({user,id})=>{
  const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated'}))+'.fake';
  localStorage.setItem('kniga-supabase-session',JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
  await new Promise((resolve,reject)=>{const r=indexedDB.open('kniga-reader',1);r.onupgradeneeded=()=>{r.result.createObjectStore('books',{keyPath:'id'});r.result.createObjectStore('preferences');};r.onsuccess=()=>{const db=r.result,tx=db.transaction(['books','preferences'],'readwrite');const text='Текст тестовой книги для проверки синхронизации. '.repeat(15),blocks=Array.from({length:70},()=>({type:'p',text,html:text}));const original=new TextEncoder().encode('<FictionBook><body>'+blocks.map((b,i)=>i===0?'<epigraph><p>'+b.text+'</p></epigraph>':'<p>'+b.text+'</p>').join('')+'</body></FictionBook>').buffer;tx.objectStore('books').put({id,title:'Проверка синхронизации',author:'Тест',fileName:'test.fb2',format:'FB2',original,addedAt:1,marks:[],blocks,chars:blocks.reduce((s,b)=>s+b.text.length,0),chapters:[]});tx.objectStore('preferences').put({anchor:{block:43,offset:0},updatedAt:100},'position:'+id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=reject;};});
 },{user,id});
 await page.goto('https://reader.test/kniga-reader/');
 await page.locator('[data-book]').first().click();
 await page.locator('.book-text[data-page]').first().waitFor({state:'attached'});
 release();
 await page.waitForFunction(()=>document.querySelector('.book-text')?.style.getPropertyValue('--font-size')==='23px');
 await page.waitForFunction(async id=>new Promise(resolve=>{const r=indexedDB.open('kniga-reader',1);r.onsuccess=()=>{const q=r.result.transaction('preferences').objectStore('preferences').get('position:'+id);q.onsuccess=()=>resolve(q.result?.anchor?.block===47);};}),id);
 await page.waitForTimeout(1200);
 const result=await page.evaluate(async id=>({font:document.querySelector('.book-text').style.getPropertyValue('--font-size'),theme:document.documentElement.dataset.theme,progress:await new Promise(resolve=>{const r=indexedDB.open('kniga-reader',1);r.onsuccess=()=>{const q=r.result.transaction('preferences').objectStore('preferences').get('position:'+id);q.onsuccess=()=>resolve(q.result);};})}),id);
 assert.equal(result.font,'23px');assert.equal(result.theme,'night');assert.equal(result.progress.anchor.block,47);assert.equal(result.progress.updatedAt,300);assert.equal(writes.length,0,'opening/reflow must not upload stale progress');assert.deepEqual(errors,[]);
 const upgraded=await page.evaluate(async id=>new Promise(resolve=>{const r=indexedDB.open('kniga-reader',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('books').objectStore('books').get(id);q.onsuccess=()=>{resolve({version:q.result.presentationVersion,role:q.result.blocks[0].presentation?.role,count:q.result.blocks.length,original:new TextDecoder().decode(q.result.original).startsWith('<FictionBook>')});db.close();};};}),id);
 assert.deepEqual(upgraded,{version:1,role:'epigraph',count:70,original:true},'legacy original must gain presentation without changing its source coordinates');
 console.log('PASS: book opened before delayed cloud response; latest typography and position applied; no stale progress uploaded.',result);
 const initialReads=requests.length;
 const position=()=>page.locator('#reader-page-position').textContent();
 const initial=await position();
 const box=await page.locator('#book-stage').boundingBox();
 const frames=async()=>page.evaluate(()=>[...document.querySelectorAll('.stf__item')].map(e=>e.style.cssText).filter(s=>/rotate|clip-path/.test(s)));
 await page.mouse.click(box.x+box.width*.9,box.y+box.height*.65);
 await page.waitForTimeout(220);assert.ok(!(await frames()).some(s=>/rotate\((?!0rad)/.test(s)),'forward stays instant');
 await page.waitForTimeout(1000);const forward=await position();assert.notEqual(forward,initial);
 await page.mouse.click(box.x+box.width*.1,box.y+box.height*.65);
 await page.waitForTimeout(220);assert.ok(!(await frames()).some(s=>/rotate\((?!0rad)/.test(s)),'backward stays instant');
 await page.waitForTimeout(1000);assert.equal(await position(),initial);
 const cdp=await context.newCDPSession(page);
 const swipe=async(from,to)=>{
  const y=box.y+box.height*.6;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from,y}]});
  for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from+(to-from)*i/8,y}]});await page.waitForTimeout(25);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(220);assert.ok(!(await frames()).some(s=>/rotate\((?!0rad)/.test(s)),'swipe stays instant');await page.waitForTimeout(1200);
 };
 await swipe(box.x+box.width*.9,box.x+box.width*.15);assert.notEqual(await position(),initial);
 await swipe(box.x+box.width*.1,box.x+box.width*.85);assert.equal(await position(),initial);
 const textPoint=async offset=>page.evaluate(offset=>{
  const p=document.querySelector('.book-page[aria-hidden="false"] .paragraph');
  const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let node,last,remaining=offset;
  while(node=walker.nextNode()){last=node;if(remaining<node.length)break;remaining-=node.length;}
  node||=last;const at=Math.min(remaining,node.length-1);
  const r=document.createRange();r.setStart(node,at);r.setEnd(node,at+1);
  const rect=r.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
 },offset);
 const select=async()=>{const p=await textPoint(20);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await page.waitForTimeout(500);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.locator('#quote-actions').waitFor();};
 await select();
 assert.equal(await page.locator('.selection-handle').count(),2);
 assert.equal(await page.evaluate(()=>window.getSelection().toString()),'');
 assert.equal(await page.locator('#quote-save').textContent(),'Цитата');
 const selectedPage=await position();
 const drag=async(edge,offset)=>{
  const handle=await page.locator(`[data-selection-handle="${edge}"]`).boundingBox(),target=await textPoint(offset);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:handle.x+22,y:handle.y+22}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:target.x,y:target.y}]});await page.waitForTimeout(100);
  assert.equal(await page.locator('#quote-actions').count(),0,'hide menu while adjusting boundaries');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.locator('#quote-actions').waitFor();
 };
 await drag('end',130);await drag('start',0);
 await page.locator('[data-selection-handle="start"]').focus();await page.keyboard.press('ArrowRight');
 assert.equal(await position(),selectedPage,'handle arrows must never turn the page');
 assert.equal(await page.locator('.selection-handle').count(),2);
 assert.equal(await position(),selectedPage,'selection drag cannot turn pages');
 assert.ok(await page.locator('.selection-fill').count()>1,'range spans multiple lines');
 await page.screenshot({path:'/tmp/reader-selection-review.png'});
 const menu=await page.locator('#quote-actions').boundingBox();assert.ok(menu.x>=0&&menu.x+menu.width<=393&&menu.y>=0&&menu.y+menu.height<=852);
 await page.locator('#quote-save').click();assert.equal(await page.locator('.reading-highlight').count()>0,true);assert.equal(await page.locator('#quote-selection').count(),0);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}}));
 await select();await page.locator('#quote-copy').click();assert.ok((await page.evaluate(()=>window.__copied)).length>0);assert.equal(await page.locator('#quote-actions').count(),0);
 await select();await page.locator('#quote-note').click();await page.locator('#note-editor').fill('Проверка заметки');await page.locator('#note-save').click();assert.equal(await page.locator('#quote-selection').count(),0);
 await select();await page.mouse.click(390,700);assert.equal(await page.locator('#quote-actions').count(),0);assert.equal(await position(),selectedPage,'outside dismissal must not turn page');
 await select();const pendingHandle=await page.locator('[data-selection-handle="end"]').boundingBox();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pendingHandle.x+22,y:pendingHandle.y+22}]});
 // Desktop Chromium cannot resize a fullscreen window. iPhone reading uses the
 // normal viewport; leaving desktop fullscreen also exercises that reflow path.
 await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
 await page.setViewportSize({width:390,height:852});await page.waitForTimeout(500);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y:300}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const fieldMenu=await page.evaluate(()=>{const input=document.createElement('textarea');document.body.append(input);const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});input.dispatchEvent(event);input.remove();return event.defaultPrevented;});
 assert.equal(fieldMenu,false);
 assert.equal(requests.length,initialReads,'page turns and annotation edits must not re-download the full library');
 assert.deepEqual(errors,[]);console.log('PASS: instant navigation, word press, draggable handles, anchored toolbar, saved quote/note, native field menus.');
 const showControls=async()=>{
  if(await page.locator('.reader.chrome-hidden').count()){
   const stage=await page.locator('#book-stage').boundingBox();
   await page.touchscreen.tap(stage.x+stage.width/2,stage.y+stage.height/2);
  }
 };
 for(let cycle=0;cycle<3;cycle++){
  await showControls();
  const before=await position();
  for(const selector of ['#contents','#search-book','#appearance']){
   await page.locator(selector).tap();
   await page.locator('dialog[open]').waitFor();
   assert.equal(await position(),before,`${selector} must open a sheet without navigating`);
   await page.locator('#close-sheet').tap();
  }
  const stage=await page.locator('#book-stage').boundingBox();
  await page.touchscreen.tap(stage.x+stage.width*.88,stage.y+stage.height*.4);
  await page.waitForFunction(previous=>document.querySelector('#reader-page-position')?.textContent!==previous,before);
  await page.touchscreen.tap(stage.x+stage.width*.12,stage.y+stage.height*.4);
  await page.waitForFunction(previous=>document.querySelector('#reader-page-position')?.textContent===previous,before);
  await page.locator('#to-library').tap();await page.locator('.library').waitFor();
  await page.locator('[data-book]').first().tap();
  await page.locator('.book-text[data-page]').first().waitFor({state:'attached'});
  assert.equal(await position(),before,'returning to the library must preserve the page');
 }
 assert.deepEqual(errors,[]);console.log('PASS: repeated settings/contents/search, edge-tap navigation, library return and saved reading position.');
}finally{await browser.close();}
