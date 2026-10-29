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
// Pairwise boundary values: three fonts, narrow/landscape pages, small/large
// text, tight/loose leading, wide fields and positive/negative letter spacing.
for(let i=0;i<36;i++)scenarios.push({
 name:`Typography boundary ${i+1}`,
 width:[320,393,430,720][i%4],height:[360,480,600][Math.floor(i/4)%3],
 settings:{...settings,font:['serif','literary','sans'][Math.floor(i/12)],fontSize:[12,22,32,48][i%4],lineHeight:[1,1.1,1.55,2.5][Math.floor(i/3)%4],margin:i%3===0?72:8,letterSpacing:i%2?3:-.5,indent:i%2?0:3,align:i%2?'justify':'left',hyphens:i%3!==0},
 txt:(passage+'«Ёжик», цифры 123, слово\u00a0с пробелом. ').repeat(5)
});
scenarios.push(
 {name:'FB2 notes, emphasis, superscripts and chapter boundaries',width:393,height:480,settings:{...settings,fontSize:32,lineHeight:1},fb2:'<FictionBook><body><section><title><p>Первая глава</p></title>'+Array.from({length:5},()=>`<p>${passage}<emphasis>Курсивный текст</emphasis> и ссылка<sup>1</sup>. ${passage}</p>`).join('')+'</section><section><title><p>Вторая глава</p></title><p>Последняя строка основной книги.</p></section></body><body name="notes"><section id="note"><p>Полный текст примечания.</p></section></body></FictionBook>'},
 {name:'Poetry, preformatted text and quotations',width:320,height:480,settings:{...settings,fontSize:22,lineHeight:1.1},fb2:'<FictionBook><body><section><poem><stanza><v>Первая строка стихотворения.</v><v>Вторая строка стихотворения.</v><v>Последняя строка.</v></stanza></poem><pre>Строка  с пробелами\n  Вторая строка\nПоследняя строка</pre><cite><p>'+passage.repeat(6)+'</p></cite></section></body></FictionBook>'},
 {name:'Oversized indivisible table fails explicitly instead of returning clipped pages',width:320,height:260,settings:{...settings,fontSize:48},expectReject:true,fb2:'<FictionBook><body><table>'+Array.from({length:40},()=>'<tr><td>Полный текст строки таблицы</td></tr>').join('')+'</table></body></FictionBook>'}
);
const report=[];
for(const scenario of scenarios){
 try{
  const book=await importBook(new TextEncoder().encode(scenario.fb2||scenario.txt),scenario.fb2?'regression.fb2':'regression.txt');
  const pages=await paginate(book.blocks,scenario),pageStats=[];let restored='';
  if(scenario.expectReject)throw Error('An oversized block was accepted');
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
  if(!scenario.fb2&&maximumBottomGap>scenario.settings.fontSize*scenario.settings.lineHeight*1.5)throw Error(`avoidable empty reading rows: bottom gap ${maximumBottomGap}px`);
  report.push({name:scenario.name,status:'PASS',pages:pages.length,sourceCharacters:restored.length,maximumBottomGapBeforeFinalPage:Math.max(0,...pageStats.slice(0,-1).map(p=>p.bottomGap))});
 }catch(error){report.push(scenario.expectReject&&/не помещается/i.test(error.message)?{name:scenario.name,status:'PASS',safeRejection:true}:{name:scenario.name,status:'FAIL',error:error.message});}
 results.textContent=JSON.stringify(report,null,2);
}
document.title=report.every(r=>r.status==='PASS')?'PASS — pagination visibility':'FAIL — pagination visibility';
document.body.dataset.result=report.every(r=>r.status==='PASS')?'pass':'fail';
