import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
try {
 const page=await browser.newPage({viewport:{width:320,height:700}});
 await page.route('https://qa.test/**',r=>{const p=new URL(r.request().url()).pathname;return r.fulfill({contentType:p.endsWith('.js')?'text/javascript':'text/html',body:p.endsWith('.js')?readFileSync(new URL('../reader'+p,import.meta.url),'utf8'):'<html lang="ru" data-theme="night"><body></body></html>'});});
 await page.goto('https://qa.test/'); await page.addStyleTag({content:readFileSync(new URL('../reader/src/style.css',import.meta.url),'utf8')});
 const result=await page.evaluate(async()=>{
 const {paginate,applyTypography}=await import('/src/pagination.js');
 const prefs={font:'serif',fontSize:23,lineHeight:1,margin:16,paragraphGap:.5,indent:1.3,letterSpacing:0,align:'justify',hyphens:true};
 const example=(role,text,extra={})=>({type:'p',text,html:text,presentation:{role,...extra}});
 const verse='Ночь, улица, фонарь, аптека,\nБессмысленный и тусклый свет.\n'.repeat(12);
 const pre='  первый ряд\n    второй ряд\n\n   третий ряд\n'.repeat(8);
 const prose='И. И. Иванов был в доме у реки. Он принёс 20 кг груза. '.repeat(18);
 const sets={verse:[example('verse',verse)],pre:[example('preformatted',pre)],emphasis:[{type:'p',text:prose,html:`<strong><em>${prose}</em></strong>`}],right:[example('attribution',prose)],center:[example('caption',prose)],sourceLeft:[example('quote',prose,{align:'left'})],br:[{type:'p',text:'Строка'.repeat(40),html:Array(40).fill('Строка').join('<br/>')}]};
 const failures=[],stats=[];
 for(const [name,blocks] of Object.entries(sets))for(const width of [280,320,393])for(const fontSize of [23,48]) {
  const s={...prefs,fontSize},height=400;
  try {
   const pages=await paginate(blocks,{width,height,settings:s});let text='';
   for(let i=0;i<pages.length;i++){
    const p=pages[i],el=document.createElement('div');el.className='book-text';el.style.cssText=`width:${width}px;height:${height}px`;applyTypography(el,s,width);el.innerHTML=p.html;document.body.append(el);text+=el.textContent;
    if(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)failures.push({name,width,fontSize,page:i,reason:'overflow',dimensions:[el.clientWidth,el.scrollWidth,el.clientHeight,el.scrollHeight]});
    const par=el.firstElementChild,style=getComputedStyle(par);
    if(['verse','pre','right','center','sourceLeft'].includes(name)&&par.classList.contains('page-continues')&&!(name==='right'?['auto','right']:name==='center'?['auto','center']:['auto','left']).includes(style.textAlignLast))failures.push({name,width,fontSize,page:i,reason:'semantic continuation forced alignment',textAlign:style.textAlign,textAlignLast:style.textAlignLast});
    if(p.start.offset!==Number(par.dataset.from)||p.end.offset!==Number(el.lastElementChild.dataset.to))failures.push({reason:'anchor mismatch',name});
    const range=document.createRange();range.selectNodeContents(par); if(range.toString()!==blocks[0].text.slice(p.start.offset,p.end.offset))failures.push({reason:'selection mismatch',name});
    el.remove();
   }
   if(text!==blocks.map(b=>b.text).join(''))failures.push({name,width,fontSize,reason:'lost source text'});
   stats.push({name,width,fontSize,pages:pages.length});
  }catch(e){failures.push({name,width,fontSize,reason:e.message});}
 }
 const picture='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1800"><rect width="800" height="1800" fill="#a59a7b"/></svg>');
 await new Promise(resolve=>{const im=new Image();im.onload=resolve;im.src=picture;});
 for(const width of [280,320,393])for(const fontSize of [23,48]) {
  const s={...prefs,fontSize},height=400,blocks=[{type:'p',text:'До рисунка.',html:'До рисунка.'},{type:'p',text:'',html:`<img alt="Рисунок" src="${picture}"/>`},example('caption','Подпись к рисунку')];
  try{const pages=await paginate(blocks,{width,height,settings:s});
   for(const p of pages){const el=document.createElement('div');el.className='book-text';el.style.cssText=`width:${width}px;height:${height}px`;applyTypography(el,s,width);el.innerHTML=p.html;document.body.append(el);const img=el.querySelector('img');if(img){await img.decode();const r=img.getBoundingClientRect(),parent=el.getBoundingClientRect();if(r.bottom>parent.bottom+1||r.right>parent.right+1)failures.push({reason:'image overflow',width,fontSize});if((fontSize===23||width>280)&&!el.querySelector('.book-caption'))failures.push({reason:'image separated from short caption',width,fontSize});}el.remove();}
  }catch(e){failures.push({reason:e.message,width,fontSize,case:'large image caption'});}
 }
 const mixed=[example('epigraph','Мысль из другой книги.'),example('attribution','И. И. Иванов'),example('quote','Это цитата, сохранённая с отступами и с исходными символами.'),example('verse','Ночь, улица, фонарь, аптека,\nБессмысленный и тусклый свет.\nЖиви ещё хоть четверть века —\nВсё будет так. Исхода нет.'),example('caption','Подпись к иллюстрации'),{type:'p',text:'Выделение и курсив.',html:'<strong>Выделение</strong> и <em>курсив.</em>'}];
 const pages=await paginate(mixed,{width:320,height:680,settings:prefs});
 const el=document.createElement('div');el.className='book-text';el.style.cssText='width:320px;height:680px';applyTypography(el,prefs,320);el.innerHTML=pages[0].html;document.body.append(el);
 return {stats,failures};
 });
 await page.screenshot({path:'/tmp/qa-books-mixed-night.png'});
 console.log(JSON.stringify({configs:result.stats.length+6,failures:result.failures.filter((v,i,a)=>a.findIndex(x=>x.name===v.name&&x.width===v.width&&x.fontSize===v.fontSize&&x.reason===v.reason)===i)},null,2));
 assert.equal(result.failures.length,0,'adversarial layout findings above');
} finally {await browser.close();}
