import {paginationModule} from './browser-modules.mjs';
const bundledPagination=await paginationModule();
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE&&engine===chromium?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true});
 const source=readFileSync(new URL('../reader/src/main.js',import.meta.url),'utf8');
 const theme=source.slice(source.indexOf('function theme(){'),source.indexOf('function fileInput()'));
 await page.route('https://layout.test/**',route=>{
  const path=new URL(route.request().url()).pathname;
  return route.fulfill({contentType:path.endsWith('.js')?'text/javascript':'text/html',body:path.endsWith('.js')?(path==='/src/pagination.js'?bundledPagination:readFileSync(new URL('../reader'+path,import.meta.url),'utf8')):readFileSync(new URL('../reader/index.html',import.meta.url),'utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'')});
 });
 await page.goto('https://layout.test/');
 await page.addStyleTag({content:readFileSync(new URL('../reader/src/style.css',import.meta.url),'utf8')});
 const themes=await page.evaluate(theme=>{
  const applyTheme=new Function('settings',theme+'theme();');
  const results=[];
  for(const name of ['paper','white','night','oled','auto'])for(const reading of [false,true]){
   document.body.classList.toggle('reading',reading);
   document.querySelector('#app').innerHTML='<div class="reader chrome-hidden"><main class="book-stage"><div class="book-page">Текст</div></main></div>';
   applyTheme({theme:name});
   const color=selector=>getComputedStyle(document.querySelector(selector)).backgroundColor;
   const probe=document.createElement('div');probe.style.backgroundColor=document.querySelector('meta[name=theme-color]').content;document.body.append(probe);
   results.push({name,reading,root:color('html'),body:color('body'),reader:color('.reader'),page:color('.book-page'),meta:getComputedStyle(probe).backgroundColor});probe.remove();
  }
  return {results,status:document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]').content};
 },theme);
 for(const result of themes.results)for(const key of ['root','reader','page','meta'])assert.equal(result[key],result.body,JSON.stringify(result));
 assert.equal(themes.status,'black-translucent','iOS must draw the themed viewport underneath the system status bar');
 const results=await page.evaluate(async()=>{
  const {restoreSettings}=await import('/src/anchors.js');
  const {paginate,applyTypography}=await import('/src/pagination.js');
  const text='Он умолк и долго молчал. Он даже побледнел. Но это была лишь временная мера. Я должен был убедиться, что убийца больше никого не убьёт. Я обязан был обеспечить безопасность невиновным. '.repeat(12);
  const result=[];
  for(const width of [320,393,430])for(const fontSize of [22,32]){
   const settings=restoreSettings({font:'sans',fontSize,lineHeight:1.2,margin:12,align:'justify',hyphens:true,theme:'night'});
   const pages=await paginate([{type:'p',text,html:text}],{width,height:600,settings});
   let restored='';const gaps=[];
   for(const p of pages){
    const el=document.createElement('div');el.className='book-text';el.style.cssText=`width:${width}px;height:600px`;applyTypography(el,settings,width);el.innerHTML=p.html;document.body.append(el);restored+=el.textContent;
    assertOverflow(el);
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode())for(let i=1;i<node.length-1;i++)if(node.data[i]===' '){
     const rect=at(i),before=at(i-1),after=at(i+1);
     if(Math.abs(before.top-after.top)<1&&rect.width>0)gaps.push(rect.width);
     function at(j){const r=document.createRange();r.setStart(node,j);r.setEnd(node,j+1);return r.getBoundingClientRect();}
    }
    el.remove();
   }
   result.push({width,fontSize,pages:pages.length,preserved:restored===text,gapCount:gaps.length,spread:Math.max(...gaps)-Math.min(...gaps),max:Math.max(...gaps),align:settings.align});
  }
  function assertOverflow(el){if(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)throw Error('clipped text');}
  return result;
 });
 for(const result of results){assert.ok(result.preserved,JSON.stringify(result));assert.ok(result.gapCount>10);assert.equal(result.align,'justify');assert.ok(result.max<result.fontSize*2,JSON.stringify(result));}
 console.log(JSON.stringify({engine:process.env.BROWSER_ENGINE||'chromium',themes:themes.results.length,layouts:results},null,2));
}finally{await browser.close();}
