// Run with Playwright installed: node tests/pagination-layout.browser.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:393,height:852}});
 const css=readFileSync(new URL('../reader/src/style.css',import.meta.url),'utf8');
 const presentation='data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../reader/src/book-presentation.js',import.meta.url),'utf8')).toString('base64');
 const source=readFileSync(new URL('../reader/src/pagination.js',import.meta.url),'utf8').replace('./book-presentation.js',presentation);
 await page.setContent(`<html lang="ru"><head><style>${css}</style></head><body></body></html>`);
 const result=await page.evaluate(async source=>{
  const {paginate,applyTypography}=await import('data:text/javascript;base64,'+btoa(unescape(encodeURIComponent(source))));
  const settings={font:'serif',fontSize:22,lineHeight:1.1,margin:8,paragraphGap:0,indent:1.3,letterSpacing:0,align:'justify',hyphens:true};
  const text='Тина обеспокоенно изучала его лицо. Вероятно, она боялась, что чем-то вызвала мое неудовольствие. '.repeat(18);
  const blocks=[{type:'p',text,html:text}];
  const pages=await paginate(blocks,{width:393,height:600,settings});
  const ends=[];let restored='';
  for(const p of pages){
   const el=document.createElement('div');el.className='book-text';el.style.width='393px';el.style.height='600px';applyTypography(el,settings,393);el.innerHTML=p.html;document.body.append(el);
   restored+=el.textContent;
   const paragraph=el.querySelector('.paragraph'),walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);let node,last;
   while(node=walker.nextNode())if(node.textContent.trim())last=node;
   const end=last.textContent.trimEnd().length,r=document.createRange();r.setStart(last,end-1);r.setEnd(last,end);
   ends.push({continued:paragraph.classList.contains('page-continues'),right:r.getBoundingClientRect().right-el.getBoundingClientRect().left,overflow:el.scrollHeight>el.clientHeight+1});
   el.remove();
  }
  const alignments={};
  for(const align of ['left','justify']){
   for(const variant of ['page-continues','', 'page-continues verse']){
    const el=document.createElement('div');el.className='book-text';applyTypography(el,{...settings,align},393);el.innerHTML=`<div class="paragraph ${variant}">Тина обеспокоенно изучала</div>`;document.body.append(el);
    alignments[align+':'+variant]=getComputedStyle(el.firstChild).textAlignLast;el.remove();
   }
  }
  return {ends,restored,text,alignments};
 },source);
 assert.equal(result.restored,result.text,'pagination must preserve every character');
 assert.ok(result.ends.length>1);
 for(const end of result.ends){
  assert.equal(end.overflow,false,'a page must fit its viewport');
  if(end.continued)assert.ok(Math.abs(end.right-385)<2,`continued line leaves ${385-end.right}px empty`);
 }
 assert.equal(result.alignments['left:page-continues'],'left');
 assert.equal(result.alignments['justify:page-continues'],'justify');
 assert.equal(result.alignments['justify:'],'auto','actual paragraph ends must remain natural');
 assert.equal(result.alignments['justify:page-continues verse'],'auto','poetry must remain natural');
 console.log(`Pagination layout passed: ${result.ends.length} pages, preserved text, full continuation lines, natural paragraph/verse endings.`);
}finally{await browser.close();}
