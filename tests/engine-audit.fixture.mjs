import {paginate,applyTypography} from '../reader/src/pagination.js';
const results=[];const report=document.querySelector('#results');
async function run(name,fn){try{results.push({name,status:'PASS',...await fn()});}catch(e){results.push({name,status:'FAIL',error:e.message});}report.textContent=JSON.stringify(results,null,2);}
const settings={font:'sans',fontSize:48,lineHeight:1.1,margin:72,paragraphGap:0,indent:0,letterSpacing:0,align:'left',hyphens:false};
await run('Unicode page boundaries are complete graphemes',async()=>{
 const text='👨‍👩‍👧‍👦👍🏽🇷🇺е\u0301'.repeat(100),blocks=[{type:'p',html:text,text}];
 const pages=await paginate(blocks,{width:320,height:260,settings});
 const boundaries=new Set([...new Intl.Segmenter('ru',{granularity:'grapheme'}).segment(text)].map(s=>s.index));boundaries.add(text.length);
 for(const page of pages)if(!boundaries.has(page.end.offset))throw Error(`Page cut inside grapheme at source UTF-16 offset ${page.end.offset}`);
 return {pages:pages.length};
});
await run('Canvas planning vs native DOM on prose',async()=>{
 const text='Для конца октября погода стояла на удивление хорошая. Он открыл книгу и начал читать. '.repeat(45),blocks=[{type:'p',text,html:text}],s={...settings,fontSize:22,margin:8,align:'justify',hyphens:true};
 const t=performance.now(),pages=await paginate(blocks,{width:393,height:600,settings:s}),ms=performance.now()-t;
 let lastGap=0;for(const page of pages.slice(0,-1)){
  const el=document.createElement('div');el.className='book-text qa-page';el.style.width='393px';el.style.height='600px';applyTypography(el,s,393);el.innerHTML=page.html;document.querySelector('#preview').append(el);
  const range=document.createRange();range.selectNodeContents(el);const rects=[...range.getClientRects()].filter(r=>r.width&&r.height);lastGap=Math.max(lastGap,el.getBoundingClientRect().bottom-Math.max(...rects.map(r=>r.bottom)));el.remove();
 }
 return {pages:pages.length,ms:Math.round(ms),maximumGap:lastGap};
});
document.body.dataset.result=results.every(r=>r.status==='PASS')?'pass':'fail';document.title=`${document.body.dataset.result}: engine audit`;
