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
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://reader.test/empty');
 await page.evaluate(async({user,id})=>{
  const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated'}))+'.fake';
  localStorage.setItem('kniga-supabase-session',JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
  await new Promise((resolve,reject)=>{const r=indexedDB.open('kniga-reader',1);r.onupgradeneeded=()=>{r.result.createObjectStore('books',{keyPath:'id'});r.result.createObjectStore('preferences');};r.onsuccess=()=>{const db=r.result,tx=db.transaction(['books','preferences'],'readwrite');const text='Текст тестовой книги для проверки синхронизации. '.repeat(15),blocks=Array.from({length:70},()=>({type:'p',text,html:text}));tx.objectStore('books').put({id,title:'Проверка синхронизации',author:'Тест',fileName:'test.txt',format:'TXT',original:new ArrayBuffer(100),addedAt:1,marks:[],blocks,chars:blocks.reduce((s,b)=>s+b.text.length,0),chapters:[]});tx.objectStore('preferences').put({anchor:{block:43,offset:0},updatedAt:100},'position:'+id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=reject;};});
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
 console.log('PASS: book opened before delayed cloud response; latest typography and position applied; no stale progress uploaded.',result);
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
 const selection=await page.evaluate(()=>{
  const text=document.querySelector('.book-page[aria-hidden="false"] .paragraph');
  const walker=document.createTreeWalker(text,NodeFilter.SHOW_TEXT),node=walker.nextNode();
  const range=document.createRange();range.setStart(node,0);range.setEnd(node,Math.min(12,node.length));
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
  const selectedText=sel.toString();
  const menu=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});text.dispatchEvent(menu);
  return {cancelled:menu.defaultPrevented,text:selectedText,nativeSelection:sel.toString(),custom:!!document.querySelector('#quote-selection span'),select:getComputedStyle(text.closest('.book-text')).webkitUserSelect};
 });
 assert.equal(selection.cancelled,true);assert.equal(selection.select,'text');assert.ok(selection.text.length>0);assert.equal(selection.nativeSelection,'');assert.equal(selection.custom,true);
 await page.locator('#quote-actions').waitFor();assert.equal(await page.locator('#quote-actions button').count(),3);
 await page.locator('#quote-save').click();assert.equal(await page.locator('.reading-highlight').count()>0,true);assert.equal(await page.locator('#quote-selection').count(),0);
 const fieldMenu=await page.evaluate(()=>{const input=document.createElement('textarea');document.body.append(input);const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});input.dispatchEvent(event);input.remove();return event.defaultPrevented;});
 assert.equal(fieldMenu,false);
 assert.deepEqual(errors,[]);console.log('PASS: instant navigation, custom selection after native dismissal, saved highlight, native field menus.');
}finally{await browser.close();}
