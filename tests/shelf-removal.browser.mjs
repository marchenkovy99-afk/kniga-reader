import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {sha256} from 'js-sha256';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
const root=fileURLToPath(new URL('../docs/',import.meta.url));
const original=Buffer.from('<FictionBook><description><title-info><book-title>Удалённая книга</book-title></title-info></description><body><section><p>Проверка удаления книги с полки.</p></section></body></FictionBook>');
const id=sha256(original),user={id:'11111111-1111-4111-8111-111111111111',email:'reader@example.test',role:'authenticated',aud:'authenticated'};
try{
 const context=await browser.newContext({viewport:{width:393,height:852},hasTouch:true,serviceWorkers:'block'});
 let downloads=0;const errors=[];
 await context.route('https://reader.test/**',route=>{
  const path=new URL(route.request().url()).pathname.replace(/^\/kniga-reader\//,'')||'index.html';
  return route.fulfill({body:readFileSync(root+path),contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'});
 });
 await context.route('https://qwnkigorqsgugcctnfmj.supabase.co/**',route=>{
  const path=new URL(route.request().url()).pathname,req=route.request();
  const json=body=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  if(path==='/auth/v1/user')return json(user);
  if(path.includes('/storage/v1/object/')){downloads++;return route.fulfill({body:original});}
  if(req.method()==='POST')return json(null);
  if(path.includes('kniga_books'))return json([{id,file_name:'removed.fb2',size_bytes:original.length}]);
  if(path.includes('kniga_states'))return json([]);
  return route.fulfill({status:500,body:'Unexpected request'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://reader.test/kniga-reader/');await page.locator('.library').waitFor();
 const upload=()=>page.locator('#file-input').setInputFiles({name:'removed.fb2',mimeType:'application/xml',buffer:original});
 await upload();await page.locator(`[data-info="${id}"]`).waitFor();
 await page.locator(`[data-info="${id}"]`).click();await page.locator('#remove-book').click();await page.locator('#confirm-remove').click();
 await page.locator(`[data-book="${id}"]`).waitFor({state:'detached'});
 const hidden=owner=>page.evaluate(owner=>new Promise(resolve=>{const r=indexedDB.open('kniga-reader',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('preferences').objectStore('preferences').get('cloud-hidden:'+owner);q.onsuccess=()=>{resolve(q.result||[]);db.close();};};}),owner);
 assert.ok((await hidden('guest')).includes(id),'guest removal must persist before login');
 await page.evaluate(user=>{
  const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated'}))+'.fake';
  localStorage.setItem('kniga-supabase-session',JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
 },user);
 for(let cycle=0;cycle<2;cycle++){
  await page.reload();await page.waitForFunction(()=>document.querySelector('#cloud-status')?.dataset.state==='saved');
  assert.equal(await page.locator(`[data-book="${id}"]`).count(),0);
  assert.equal(downloads,0,'sync must skip removed files, including after reload');
  assert.ok((await hidden(user.id)).includes(id));
 }
 await upload();await page.locator(`[data-book="${id}"]`).waitFor();assert.equal((await hidden(user.id)).includes(id),false,'explicit file import restores the book');
 await page.reload();await page.locator(`[data-book="${id}"]`).waitFor();assert.equal(downloads,0);assert.deepEqual(errors,[]);
 console.log('PASS: UI removal before login, account sync, two reloads without a download, explicit reimport and persisted shelf.');
}finally{await browser.close();}
