import {paginationModule} from './browser-modules.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
try{
 const page=await browser.newPage({viewport:{width:393,height:852}});
 const module=await paginationModule();
 await page.setContent('<html lang="ru"><body></body></html>');
 await page.addStyleTag({content:readFileSync(new URL('../reader/src/style.css',import.meta.url),'utf8')});
 const result=await page.evaluate(async source=>{
  const {paginate}=await import('data:text/javascript;base64,'+btoa(unescape(encodeURIComponent(source))));
  const text='Он умолк и долго молчал. Он даже побледнел. Но это была лишь временная мера. Я должен был убедиться, что убийца больше никого не убьёт. Я обязан был обеспечить безопасность невиновным. '.repeat(7);
  const blocks=Array.from({length:90},()=>({type:'p',text,html:text,presentation:{}}));
  let reads=0,parsed=0;
  const rect=Range.prototype.getBoundingClientRect,html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  Range.prototype.getBoundingClientRect=function(){reads++;return rect.call(this);};
  Object.defineProperty(Element.prototype,'innerHTML',{...html,set(value){parsed+=String(value).length;return html.set.call(this,value);}});
  const started=performance.now();
  let pages;
  try{pages=await paginate(blocks,{width:393,height:800,settings:{font:'sans',fontSize:22,lineHeight:1.2,margin:12,indent:1.3,paragraphGap:0,letterSpacing:0,align:'justify',hyphens:true}});}
  finally{Range.prototype.getBoundingClientRect=rect;Object.defineProperty(Element.prototype,'innerHTML',html);}
  const element=document.createElement('div');element.innerHTML=pages.map(p=>p.html).join('');
  return {ms:Math.round(performance.now()-started),characters:text.length*blocks.length,pages:pages.length,rangeReads:reads,parsedCharacters:parsed,preserved:element.textContent===blocks.map(b=>b.text).join('')};
 },module);
 console.log(JSON.stringify(result));
 assert.ok(result.preserved);
 assert.ok(result.rangeReads<15000,'paragraph layout must not measure every candidate line through the DOM');
 assert.ok(result.parsedCharacters<result.characters*80,'page measurement must not repeatedly parse full paragraphs');
}finally{await browser.close();}
