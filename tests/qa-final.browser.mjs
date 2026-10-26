import {paginationModule} from './browser-modules.mjs';
const bundledPagination=await paginationModule();
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
try {
 const page=await browser.newPage({viewport:{width:320,height:700}});
 await page.route('https://final.test/**',route=>{
  const path=new URL(route.request().url()).pathname;
  return route.fulfill({contentType:path.endsWith('.js')?'text/javascript':'text/html',body:path.endsWith('.js')?(path==='/src/pagination.js'?bundledPagination:readFileSync(new URL('../reader'+path,import.meta.url),'utf8')):'<html lang="ru"><body></body></html>'});
 });
 await page.goto('https://final.test/');
 await page.addStyleTag({content:readFileSync(new URL('../reader/src/style.css',import.meta.url),'utf8')});
 const result=await page.evaluate(async()=>{
  const {paginate,applyTypography}=await import('/src/pagination.js');
  const escaped=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
  const blocks=[
   {type:'p',text:'А'.repeat(250),html:'А'.repeat(250)},
   {type:'p',text:'https://example.test/'+('long_segment'.repeat(30)),html:'https://example.test/'+('long_segment'.repeat(30))},
   {type:'p',text:'😀е́ 👩‍🚀 🐈 Слово '.repeat(45),html:'<strong>'+('😀е́ 👩‍🚀 🐈 Слово '.repeat(45))+'</strong>'},
   {type:'p',text:'<исходный текст> & 20 кг. '.repeat(30),html:escaped('<исходный текст> & 20 кг. '.repeat(30))},
   {type:'p',text:'И. И. Иванов в доме. '.repeat(30),html:'<em>'+('И. И. Иванов в доме. '.repeat(30))+'</em>',presentation:{role:'quote'}},
  ];
  const failures=[];let configs=0;
  for(const width of [240,280,320,393])for(const fontSize of [12,23,48])for(const font of ['serif','sans']) {
   const settings={font,fontSize,lineHeight:1,margin:72,paragraphGap:0,indent:1.3,letterSpacing:0,align:'justify',hyphens:false},height=400;
   const pages=await paginate(blocks,{width,height,settings});let restored='';
   for(const [i,p] of pages.entries()) {
    const el=document.createElement('div');el.className='book-text';el.style.cssText=`width:${width}px;height:${height}px`;applyTypography(el,settings,width);el.innerHTML=p.html;document.body.append(el);
    if(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)failures.push({width,fontSize,font,page:i,reason:'overflow'});
    for(const part of el.querySelectorAll('.paragraph')) {
     const b=Number(part.dataset.block),from=Number(part.dataset.from),to=Number(part.dataset.to);
     if(part.textContent!==blocks[b].text.slice(from,to))failures.push({width,fontSize,font,page:i,reason:'source-coordinate mismatch'});
     if(/[\uD800-\uDBFF]$/.test(part.textContent)||/^[\uDC00-\uDFFF]/.test(part.textContent))failures.push({width,fontSize,font,page:i,reason:'surrogate split'});
     restored+=part.textContent;
    }
    if(!i&&(p.start.block!==0||p.start.offset!==0))failures.push({reason:'bad first anchor'});
    if(i){const prev=pages[i-1].end;if(!(p.start.block===prev.block&&p.start.offset===prev.offset||p.start.block===prev.block+1&&p.start.offset===0&&prev.offset===blocks[prev.block].text.length))failures.push({reason:'noncontiguous page anchors'});}
    el.remove();
   }
   if(restored!==blocks.map(b=>b.text).join(''))failures.push({width,fontSize,font,reason:'source reconstruction'});
   configs++;
  }
  if(document.querySelector('.measure'))failures.push({reason:'measurement DOM leak'});
  const controller=new AbortController();controller.abort();
  try {await paginate(blocks,{width:320,height:400,settings:{font:'serif',fontSize:23,lineHeight:1,margin:8,paragraphGap:0,indent:0,letterSpacing:0,align:'left',hyphens:false},signal:controller.signal});failures.push({reason:'abort ignored'});}catch(e){if(e.name!=='AbortError')failures.push({reason:'wrong abort error'});}
  if(document.querySelector('.measure'))failures.push({reason:'aborted measurement DOM leak'});
  return {configs,failures};
 });
 console.log(JSON.stringify(result,null,2));
 assert.deepEqual(result.failures,[]);
}finally{await browser.close();}
