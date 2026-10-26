import {paginationModule} from './browser-modules.mjs';
const bundledPagination=await paginationModule();
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:393,height:852}});
 await page.route('https://layout.test/**',route=>{
  const path=new URL(route.request().url()).pathname;
  return route.fulfill({contentType:path.endsWith('.js')?'text/javascript':'text/html',body:path.endsWith('.js')?(path==='/src/pagination.js'?bundledPagination:readFileSync(new URL('../reader'+path,import.meta.url),'utf8')):'<html lang="ru"><body></body></html>'});
 });
 await page.goto('https://layout.test/');
 await page.addStyleTag({content:readFileSync(new URL('../reader/src/style.css',import.meta.url),'utf8')});
 const result=await page.evaluate(async()=>{
  const {paginate,applyTypography}=await import('/src/pagination.js');
  const s={font:'serif',fontSize:20,lineHeight:1.2,margin:8,paragraphGap:0,indent:0,letterSpacing:0,align:'left',hyphens:false};
  const lines=(n,label)=>({type:'p',text:Array(n).fill(label).join(''),html:Array(n).fill(label).join('<br/>')});
  const inspect=(pages,blocks,width,height,settings=s)=>{
   let restored='';const rendered=[];
   for(const p of pages){
    const el=document.createElement('div');el.className='book-text';el.style.cssText=`width:${width}px;height:${height}px`;applyTypography(el,settings,width);el.innerHTML=p.html;document.body.append(el);
    restored+=el.textContent;
    const parts=[...el.querySelectorAll('.paragraph')].map(par=>{
     const range=document.createRange();range.selectNodeContents(par);
     const tops=[...range.getClientRects()].filter(r=>r.width>.1&&r.height>.1).map(r=>Math.round(r.top));
     return {block:Number(par.dataset.block),lines:new Set(tops).size,role:par.className};
    });
    rendered.push({parts,dimensions:[el.clientWidth,el.scrollWidth,el.clientHeight,el.scrollHeight],glue:[...el.querySelectorAll('.book-glue')].map(s=>[s.textContent,s.getBoundingClientRect().width]),overflow:el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1});el.remove();
   }
   return {rendered,restored,source:blocks.map(b=>b.text).join('')};
  };
  const headings=[lines(5,'Начальная строка. '),{type:'h3',text:'Подзаголовок',html:'Подзаголовок'},lines(3,'Дальнейшая строка. ')];
  const hp=await paginate(headings,{width:320,height:200,settings:s});
  const widows=[lines(2,'Начало. '),lines(5,'Строка абзаца. ')];
  const wp=await paginate(widows,{width:320,height:160,settings:s});
  const pic='<img alt="Рисунок" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"/>';
  const captions=[{type:'p',text:'',html:pic},{type:'p',text:'Подпись к иллюстрации',html:'Подпись к иллюстрации',presentation:{role:'caption'}}];
  const cp=await paginate(captions,{width:320,height:240,settings:s});
  const prose='Я был в доме у реки. И. И. Иванов принёс 20 кг груза. '.repeat(12);
  const typographic=[{type:'p',text:prose,html:prose}];
  const typography=[];
  for(const settings of [s,{...s,fontSize:48,margin:72,lineHeight:1,align:'justify'}]){
   const pages=await paginate(typographic,{width:280,height:300,settings});
   typography.push({...inspect(pages,typographic,280,300,settings),groups:pages.reduce((n,p)=>n+(p.html.match(/book-glue/g)||[]).length,0)});
  }
  return {headings:inspect(hp,headings,320,200),widows:inspect(wp,widows,320,160),captions:inspect(cp,captions,320,240),typography};
 });
 assert.equal(result.headings.rendered[0].parts.some(p=>p.block===1),false,'subheading must move with at least two lines of its next paragraph');
 const paragraphParts=result.widows.rendered.flatMap(p=>p.parts.filter(b=>b.block===1));
 assert.ok(paragraphParts.length>1);assert.ok(paragraphParts.every(p=>p.lines>=2),'avoid a one-line paragraph fragment when two lines can fit');
 assert.equal(result.captions.rendered.length,1,'short caption must share its image page');
 for(const example of [result.headings,result.widows,result.captions,...result.typography]){
  assert.equal(example.restored,example.source,'rendering must preserve every original character');
  assert.ok(example.rendered.every(p=>!p.overflow),'no page may clip text: '+JSON.stringify(example));
 }
 assert.ok(result.typography[0].groups>0,'short Russian prepositions, initials and units stay together');
 console.log('PASS: subheading keep-with-next, two-line fragments, image/caption, Russian typography, narrow 48px text and exact source reconstruction.');
}finally{await browser.close();}
