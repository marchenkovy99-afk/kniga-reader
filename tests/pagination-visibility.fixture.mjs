import {importBook} from '../reader/src/importer.js';
import {paginate,applyTypography} from '../reader/src/pagination.js';

const results=document.querySelector('#results'),preview=document.querySelector('#preview');
const settings={font:'serif',fontSize:22,lineHeight:1.1,margin:8,paragraphGap:0,indent:1.3,letterSpacing:0,align:'justify',hyphens:true};
const passage='Тина обеспокоенно изучала его лицо. Вероятно, она боялась, что чем-то вызвала моё неудовольствие. Йог шёл вдоль берега. ';
const scenarios=[
 {name:'TXT with source newlines',width:393,height:480,settings,txt:Array.from({length:35},(_,i)=>`Строка ${i+1}. ${passage.repeat(2)}`).join('\n')},
 {name:'Large type with tight lines',width:320,height:360,settings:{...settings,fontSize:48,lineHeight:1,align:'left'},txt:passage.repeat(32)},
 {name:'Justified compact pages',width:393,height:600,settings,txt:passage.repeat(90)},
 {name:'Landscape tight text',width:720,height:260,settings:{...settings,fontSize:36,lineHeight:1,align:'justify'},txt:passage.repeat(50)},
 {name:'Long word wraps without horizontal clipping',width:320,height:360,settings:{...settings,fontSize:30,lineHeight:1.1,align:'left',hyphens:false},txt:('сверхдлинноесловодляпроверкиширины'.repeat(8)+' ').repeat(10)},
];
const report=[];
for(const scenario of scenarios){
 try{
  const book=await importBook(new TextEncoder().encode(scenario.txt),'regression.txt');
  const pages=await paginate(book.blocks,scenario),pageStats=[];let restored='';
  for(const [index,page] of pages.entries()){
   const el=document.createElement('div');el.className='book-text qa-page';el.style.width=scenario.width+'px';el.style.height=scenario.height+'px';applyTypography(el,scenario.settings,scenario.width);el.innerHTML=page.html;preview.append(el);
   const bounds=el.getBoundingClientRect(),left=bounds.left+el.clientLeft,top=bounds.top+el.clientTop,right=left+el.clientWidth,bottom=top+el.clientHeight;
   const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),range=document.createRange();let node,lastBottom=top,rectangles=0;
   while(node=walker.nextNode()){
    if(!node.data.trim())continue;range.selectNodeContents(node);
    for(const r of range.getClientRects()){
     if(r.width<=0||r.height<=0)continue;rectangles++;lastBottom=Math.max(lastBottom,r.bottom);
     if(r.left<left-.02||r.right>right+.02||r.top<top-.02||r.bottom>bottom+.02)throw Error(`page ${index+1}: clipped text rectangle ${JSON.stringify({left:r.left-left,right:r.right-left,top:r.top-top,bottom:r.bottom-top})}`);
    }
   }
   for(const item of el.querySelectorAll('img,table,.book-page-hyphen')){
    const r=item.getBoundingClientRect();if(r.width>0&&r.height>0&&(r.left<left-.02||r.right>right+.02||r.top<top-.02||r.bottom>bottom+.02))throw Error(`page ${index+1}: clipped generated content`);
   }
   if(el.scrollHeight>el.clientHeight||el.scrollWidth>el.clientWidth)throw Error(`page ${index+1}: scroll overflow`);
   restored+=el.textContent;pageStats.push({page:index+1,rectangles,bottomGap:Math.round((bottom-lastBottom)*100)/100});
   if(index===0){const title=document.createElement('h2');title.textContent=scenario.name;preview.insertBefore(title,el);}else el.remove();
  }
  if(restored!==book.blocks.map(b=>b.text).join(''))throw Error('source text mismatch');
  if(!pages.length)throw Error('no pages');
  const maximumBottomGap=Math.max(0,...pageStats.slice(0,-1).map(p=>p.bottomGap));
  if(maximumBottomGap>scenario.settings.fontSize*scenario.settings.lineHeight*1.5)throw Error(`avoidable empty reading rows: bottom gap ${maximumBottomGap}px`);
  report.push({name:scenario.name,status:'PASS',pages:pages.length,sourceCharacters:restored.length,maximumBottomGapBeforeFinalPage:Math.max(0,...pageStats.slice(0,-1).map(p=>p.bottomGap))});
 }catch(error){report.push({name:scenario.name,status:'FAIL',error:error.message});}
 results.textContent=JSON.stringify(report,null,2);
}
document.title=report.every(r=>r.status==='PASS')?'PASS — pagination visibility':'FAIL — pagination visibility';
document.body.dataset.result=report.every(r=>r.status==='PASS')?'pass':'fail';
