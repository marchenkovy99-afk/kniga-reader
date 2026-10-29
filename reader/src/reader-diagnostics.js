/** Local-only geometry report for an actual installed iPhone PWA.
 * Never include book text, title, author, source markup or account identifiers.
 */
const px=value=>Math.round(Number(value)||0);
const digit=value=>Number.isFinite(value)?Math.round(value*10)/10:null;
function sourceContinuous(end,next){
 if(!end||!next)return null;
 return end.block===next.block&&end.offset===next.offset||
   end.block+1===next.block&&next.offset===0;
}
export function describeReadingGeometry({doc=document,win=window,glyphBounds,pageEnd,nextStart,blockType,atParagraphEnd}={}){
 const stage=doc.querySelector?.('#book-stage');
 const text=doc.querySelector?.('.book-page[aria-hidden="false"]')?.querySelector?.('.book-text');
 const stageBox=stage?.getBoundingClientRect?.();
 const rects=glyphBounds||[];
 if(!glyphBounds&&text&&doc.createTreeWalker&&doc.createRange){
  const walker=doc.createTreeWalker(text,4),range=doc.createRange();let node;
  while(node=walker.nextNode()){
   if(!node.data.trim())continue;
   range.selectNodeContents(node);
   for(const rect of range.getClientRects())if(rect.width>1&&rect.height>2)rects.push(rect);
  }
 }
 const style=text?win.getComputedStyle?.(text):null;
 const lineHeight=Number.parseFloat(style?.lineHeight)||0;
 const firstGlyphTop=rects.length?Math.min(...rects.map(rect=>rect.top)):null;
 const lastGlyphBottom=rects.length?Math.max(...rects.map(rect=>rect.bottom)):null;
 const gap=lastGlyphBottom==null||!stageBox?null:Math.max(0,stageBox.bottom-lastGlyphBottom);
 const fragments=text?.querySelectorAll?.('[data-block]')||[];
 const lastFragment=fragments.length?fragments[fragments.length-1]:null;
 const lastOffset=lastFragment?{block:Number(lastFragment.dataset.block),offset:Number(lastFragment.dataset.to)}:null;
 const end=pageEnd||lastOffset;
 return {
  viewportHeight:px(win.innerHeight),visualHeight:px(win.visualViewport?.height),
  documentHeight:px(doc.documentElement?.clientHeight),
  cssHeight:px(doc.documentElement?.getBoundingClientRect?.().height||0),
  installed:Boolean(win.navigator?.standalone||win.matchMedia?.('(display-mode: standalone)')?.matches),
  readerTop:digit(doc.querySelector?.('.reader')?.getBoundingClientRect?.().top),
  readerBottom:digit(doc.querySelector?.('.reader')?.getBoundingClientRect?.().bottom),
  stageTop:digit(stageBox?.top),stageBottom:digit(stageBox?.bottom),
  firstGlyphTop:digit(firstGlyphTop),lastGlyphBottom:digit(lastGlyphBottom),
  lineHeight:digit(lineHeight),freeSpace:digit(gap),
  emptyLines:lineHeight>0&&gap!==null?Math.max(0,Math.floor((gap-2)/lineHeight)):null,
  fontSize:px(Number.parseFloat(style?.fontSize)),paddingBottom:digit(Number.parseFloat(style?.paddingBottom)),
  atParagraphEnd:typeof atParagraphEnd==='boolean'?atParagraphEnd:null,
  blockType:blockType||'неизвестно',
  sourceContinuous:sourceContinuous(end,nextStart),
  pageEnd:end,nextStart
 };
}
export function diagnosticSummary(d){
 const yes=value=>value==null?'неизвестно':value?'да':'нет';
 const val=value=>value==null?'?':value;
 return [
  'Диагностика PWA · только размеры, без текста книги',
  'Высота окна: '+val(d.viewportHeight)+' · visual: '+val(d.visualHeight)+' · document: '+val(d.documentHeight),
  'CSS-контейнер: '+val(d.cssHeight)+' · PWA: '+yes(d.installed),
  'Границы страницы: '+val(d.stageTop)+'–'+val(d.stageBottom),
  'Последняя строка: '+val(d.lastGlyphBottom),
  'Свободное место: '+val(d.freeSpace)+' px · примерно '+val(d.emptyLines)+' строк',
  'Шрифт: '+val(d.fontSize)+' px · шаг строки: '+val(d.lineHeight)+' px',
  'абзац завершён: '+yes(d.atParagraphEnd),
  'следующий блок: '+val(d.blockType),
  'Непрерывность фрагментов: '+yes(d.sourceContinuous),
  'Якорь конца: '+(d.pageEnd?d.pageEnd.block+':'+d.pageEnd.offset:'?'),
  'Якорь следующей: '+(d.nextStart?d.nextStart.block+':'+d.nextStart.offset:'?')
 ].join('\n');
}
