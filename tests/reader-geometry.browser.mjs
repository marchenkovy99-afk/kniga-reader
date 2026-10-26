import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
const root=fileURLToPath(new URL('../docs/',import.meta.url));
try{
 const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,serviceWorkers:'block'});
 await page.route('https://reader.test/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/empty')return route.fulfill({contentType:'text/html',body:'<html></html>'});
  const rel=path.replace(/^\/kniga-reader\//,'')||'index.html';let body=readFileSync(root+rel,'utf8');
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
 await page.goto('https://reader.test/kniga-reader/');await page.locator('[data-book]').first().click();await page.locator('.book-page[aria-hidden="false"] .book-text').waitFor();
 const pages=[];
 for(let i=0;i<6;i++){
  pages.push(await page.evaluate(()=>{
   const page=document.querySelector('.book-page[aria-hidden="false"]'),text=page.querySelector('.book-text'),reader=document.querySelector('.reader'),stage=document.querySelector('#book-stage');
   const range=document.createRange();range.selectNodeContents(text);const rects=[...range.getClientRects()].filter(r=>r.height>2&&r.width>1),bounds=stage.getBoundingClientRect();
   const first=Math.min(...rects.map(r=>r.top)),last=Math.max(...rects.map(r=>r.bottom));
   return {position:document.querySelector('#reader-page-position').textContent,stageTop:bounds.top,stageBottom:bounds.bottom,stageHeight:stage.clientHeight,pageHeight:page.clientHeight,readerHeight:reader.clientHeight,first,last,unused:bounds.bottom-last,lineHeight:parseFloat(getComputedStyle(text).lineHeight),padding:getComputedStyle(text).padding};
  }));
  if(!i)await page.screenshot({path:'/tmp/kniga-viewport-review.png'});
  const before=await page.locator('#reader-page-position').textContent();await page.keyboard.press('ArrowRight');await page.waitForFunction(before=>document.querySelector('#reader-page-position').textContent!==before,before);
 }
 console.log(JSON.stringify(pages,null,2));
 assert.ok(pages.every(p=>p.first>=59+14),'first text line must clear the system edge effect');
 assert.ok(pages.every(p=>p.unused<=p.lineHeight+4),'ordinary continued text must fill the last available line');
}finally{await browser.close();}
