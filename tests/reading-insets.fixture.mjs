import css from '../reader/src/style.css?inline';
import {paginate,applyTypography} from '../reader/src/pagination.js';
import {assertPageIntegrity} from '../reader/src/page-integrity.js';
const results=[],report=document.querySelector('#results');
const check=(ok,message)=>{if(!ok)throw Error(message);};
const text='Он открыл книгу и продолжил чтение. Все строки видны целиком, а каждое слово сохраняется на следующей странице. '.repeat(80);
const blocks=[{type:'p',text,html:text}];
for(const screen of [{width:393,height:852,top:59,bottom:34},{width:430,height:932,top:59,bottom:34},{width:852,height:393,top:0,bottom:21},{width:375,height:667,top:20,bottom:0}]){
 let frame;
 try{
  frame=document.createElement('iframe');frame.style.cssText=`width:${screen.width}px;height:${screen.height}px;border:0;display:block`;
  const styles=css.replace(/env\(safe-area-inset-(top|bottom)(?:,\s*0px)?\)/g,(_,edge)=>screen[edge]+'px');
  frame.srcdoc=`<!doctype html><html lang="ru"><style>${styles}</style><body class="reading"><div id="app"><div class="reader chrome-hidden"><main class="book-stage"></main></div></div></body>`;
  const loaded=new Promise(resolve=>frame.onload=resolve);document.querySelector('#preview').append(frame);await loaded;
  const doc=frame.contentDocument,stage=doc.querySelector('.book-stage'),bounds=stage.getBoundingClientRect();
  check(bounds.top>=screen.top+1.9&&bounds.top<=screen.top+2.1,`Excess top space: ${bounds.top-screen.top}px beyond safe area`);
  const bottomInset=screen.height-bounds.bottom,expectedBottom=Math.max(44,screen.bottom+10);
  check(Math.abs(bottomInset-expectedBottom)<1,`Gesture gutter: ${bottomInset}px, expected ${expectedBottom}px`);
  const settings={font:'sans',fontSize:22,lineHeight:1.2,margin:12,paragraphGap:0,indent:1.3,letterSpacing:0,align:'justify',hyphens:true};
  const pages=await paginate(blocks,{width:Math.floor(bounds.width),height:Math.floor(bounds.height),settings});assertPageIntegrity(blocks,pages);
  let restored='',maxUnused=0,first;
  for(const [index,page] of pages.entries()){
   const el=doc.createElement('div');el.className='book-text';el.dataset.engine='dom';el.innerHTML=page.html;applyTypography(el,settings,bounds.width);stage.replaceChildren(el);
   const walker=doc.createTreeWalker(el,4),range=doc.createRange(),rects=[];let node;
   while(node=walker.nextNode()){if(!node.data.trim())continue;range.selectNodeContents(node);rects.push(...[...range.getClientRects()].filter(r=>r.width>0&&r.height>0));}
   check(rects.every(r=>r.top>=bounds.top-.02&&r.bottom<=bounds.bottom+.02&&r.left>=bounds.left-.02&&r.right<=bounds.right+.02),`Clipped glyph on page ${index}: ${JSON.stringify({bounds:bounds.toJSON(),text:el.getBoundingClientRect().toJSON(),bad:rects.filter(r=>r.top<bounds.top-.02||r.bottom>bounds.bottom+.02||r.left<bounds.left-.02||r.right>bounds.right+.02).map(r=>r.toJSON()).slice(0,3)})}`);
   if(index===0){first=Math.min(...rects.map(r=>r.top));check(first>=screen.top+2&&first<=screen.top+10,'First glyph must start directly below the safe area');}
   const lastGlyph=Math.max(...rects.map(r=>r.bottom));
   check(screen.height-lastGlyph>=43.5,`Last glyph must clear screen bottom: ${screen.height-lastGlyph}px on page ${index}`);
   const unused=bounds.bottom-lastGlyph;
   if(index<pages.length-1){check(unused<settings.fontSize*settings.lineHeight+4,`Unused complete row: ${unused}`);maxUnused=Math.max(maxUnused,unused);}
   restored+=el.textContent;
  }
  check(restored===text,'Source text changed');
  results.push({screen,status:'PASS',stageTop:bounds.top,bottomInset,first,pages:pages.length,maxUnused});
 }catch(error){results.push({screen,status:'FAIL',error:error.message});}
 finally{frame?.remove();}
 report.textContent=JSON.stringify(results,null,2);
}
document.body.dataset.result=results.every(r=>r.status==='PASS')?'pass':'fail';
