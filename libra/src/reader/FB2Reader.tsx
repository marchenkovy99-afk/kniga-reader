import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Block, Chapter, ReaderPosition, ReaderSettings, StoredBook } from '../domain';
import type { FB2Anchor } from '../anchors';
import { getAnchorPage, getPageAnchor } from '../anchors';
import { loadParsedFB2 } from './parsedFB2Cache';
import { clampPage, restoreChapter, measureRenderedPages, measureColumnStride, progressOf } from '../pagination';
import { savePosition } from '../storage';
import { ReadingControls } from '../components/ReadingControls';
import { fontStack } from '../readerSettings';

const GAP=24;
function BookBlock({block,index,onMediaLoaded,onOpenTable}:{block:Block;index:number;onMediaLoaded:()=>void;onOpenTable:(rows:string[][])=>void}){
 const oversized=block.kind==='table'&&(block.rows.length>9||block.rows.some(row=>row.join(' ').length>300)||block.rows.flat().join(' ').length>1100);
 if(block.kind==='image')return <figure data-block-index={index} className="book-figure">{block.src?<img src={block.src} alt={block.alt} onLoad={onMediaLoaded} onError={onMediaLoaded}/>:<span className="book-image-missing" role="note">{block.alt}</span>}</figure>;
 if(block.kind==='table'){
  if(oversized)return <button data-block-index={index} className="book-table-launch" onClick={()=>onOpenTable(block.rows)}>Большая таблица · {block.rows.length} строк <span>Открыть полностью ↗</span></button>;
  return <table data-block-index={index} className="book-table"><tbody>{block.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table>;
 }
 if(block.kind==='heading')return <h2 data-block-index={index} className="book-heading">{block.text}</h2>;
 if(block.kind==='verse')return <div data-block-index={index} className="book-verse">{block.text}</div>;
 return <p data-block-index={index} className="book-paragraph">{block.text}</p>;
}
type Props={book:StoredBook;settings:ReaderSettings;onSettings:(s:ReaderSettings)=>void;onBack:()=>void};
export function FB2Reader({book,settings,onSettings,onBack}:Props){
 const [chapters,setChapters]=useState<Chapter[]>([]);
 const [error,setError]=useState('');
 const [chapter,setChapter]=useState(book.position?.chapter||0);
 const [page,setPage]=useState(book.position?.page||0);
 const [pages,setPages]=useState(1);
 const [stride,setStride]=useState(0);
 const [geometry,setGeometry]=useState({width:0,height:0});
 const [measuredKey,setMeasuredKey]=useState('');
 const [mediaVersion,setMediaVersion]=useState(0);
 const [reflowing,setReflowing]=useState(false);
 const [expandedTable,setExpandedTable]=useState<string[][]|null>(null);
 const viewport=useRef<HTMLDivElement>(null);
 const flow=useRef<HTMLDivElement>(null);
 const previous=useRef(false);
 const anchorRef=useRef<FB2Anchor|undefined>(book.position?.anchor);
 const lastPosition=useRef<ReaderPosition|undefined>(book.position);
 useEffect(()=>{
  let cancelled=false;
  loadParsedFB2(book).then(result=>{
   if(cancelled)return;
   const savedChapter=lastPosition.current?.chapter;
   const validChapter=restoreChapter(savedChapter,result.chapters.length);
   if(validChapter!==savedChapter){
    // Keep original book bytes and bookmarks. Discard only the unusable
    // navigation location so pagination can start from visible text.
    anchorRef.current=undefined;
    lastPosition.current=undefined;
    setPage(0);
   }
   setChapter(validChapter);
   setChapters(result.chapters);
  }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Не удалось открыть FB2')});
  return ()=>{cancelled=true};
 },[book.id,book.file]);
 useLayoutEffect(()=>{
  const el=viewport.current;if(!el)return;
  const recalc=()=>{
   const width=el.clientWidth,height=el.clientHeight;
   setGeometry(old=>old.width===width&&old.height===height?old:{width,height});
  };
  const observer=new ResizeObserver(recalc);
  observer.observe(el);recalc();
  return ()=>observer.disconnect();
 // Re-measure synchronously when the margin slider changes. ResizeObserver
 // alone reports the new content box asynchronously (after a paint), leaving
 // a frame where the old column stride offsets newly narrowed text.
 },[chapters.length,settings.margin,settings.marginRight,settings.verticalMargin,settings.bottomMargin]);
 const layoutKey=useMemo(()=>[
  chapter,geometry.width,geometry.height,settings.fontSize,
  settings.lineHeight,settings.margin,settings.fontFamily,
  settings.align,settings.paragraphIndent,settings.wordSpacing,settings.letterSpacing,
  settings.paragraphSpacing,settings.verticalMargin,settings.marginRight,settings.bottomMargin,
  settings.fontWeight,settings.hyphenation
 ].join(':'),[chapter,geometry.width,geometry.height,settings.fontSize,settings.lineHeight,
  settings.margin,settings.fontFamily,settings.align,settings.paragraphIndent,
  settings.wordSpacing,settings.letterSpacing,settings.paragraphSpacing,settings.verticalMargin,
  settings.marginRight,settings.bottomMargin,settings.fontWeight,settings.hyphenation]);
 useLayoutEffect(()=>{
  if(!flow.current||!geometry.width||!geometry.height)return;
  let active=true;
  // A font/margin change is a re-layout, not a page turn. Animating from
  // the old column origin causes Safari to clip content mid-transition.
  // Regular user-initiated page flips retain their optional animation.
  setReflowing(true);
  const animationTimer=window.setTimeout(()=>{if(active)setReflowing(false)},360);
  const compute=()=>{
   if(!active||!flow.current)return;
   const current=flow.current;
   const actualStride=measureColumnStride(current,geometry.width,GAP);
   const geo={width:geometry.width,gap:GAP,stride:actualStride};
   const count=measureRenderedPages(current,geometry.width,GAP,actualStride);
   setStride(old=>Math.abs(old-actualStride)<.01?old:actualStride);
   const anchored=anchorRef.current?getAnchorPage(current,anchorRef.current,geo):null;
   // Re-running measurements (fonts.ready, image loads, viewport changes)
   // must not undo an explicit chapter-boundary jump. Reuse the last page
   // until a precise source anchor is available.
   const selected=previous.current?count-1:anchored??(
    lastPosition.current?.chapter===chapter?clampPage(lastPosition.current.page,count):0);
   if(previous.current){
    lastPosition.current={chapter,page:selected,fraction:1,updatedAt:Date.now()};
    const lastAnchor=getPageAnchor(current,selected,geo);
    if(lastAnchor)anchorRef.current=lastAnchor;
   }
   previous.current=false;
   setPages(count);setPage(clampPage(selected,count));setMeasuredKey(layoutKey);
  };
  const frame=requestAnimationFrame(compute);
  void document.fonts.ready.then(()=>{if(active)requestAnimationFrame(compute)});
  return ()=>{active=false;clearTimeout(animationTimer);cancelAnimationFrame(frame)};
 },[chapters,chapter,geometry.width,geometry.height,layoutKey,mediaVersion]);
 const ready=Boolean(chapters[chapter]&&geometry.width>0&&geometry.height>0&&measuredKey===layoutKey);
 useEffect(()=>{
  if(!ready||!flow.current)return;
  const anchor=getPageAnchor(flow.current,page,{width:geometry.width,gap:GAP,stride:stride||geometry.width+GAP});
  if(anchor)anchorRef.current=anchor;
  const position:ReaderPosition={chapter,page,fraction:pages>1?page/(pages-1):0,
   anchor:anchorRef.current,updatedAt:Date.now()};
  lastPosition.current=position;
  // A small independent IndexedDB record is cheap enough to persist immediately.
  // Saving on each page flip avoids losing progress when iOS suspends the PWA.
  void savePosition(book.id,position).catch(console.error);
 },[ready,book.id,chapter,page,pages,geometry.width,layoutKey,stride]);
 const setReaderPage=(target:number)=>{
  if(!ready||!flow.current)return;
  const safe=clampPage(target,pages);
  const anchor=getPageAnchor(flow.current,safe,{width:geometry.width,gap:GAP,stride:stride||geometry.width+GAP});
  if(anchor)anchorRef.current=anchor;
  setPage(safe);
 };
 const switchChapter=(nextChapter:number,toLast=false)=>{
  if(!chapters[nextChapter])return;
  previous.current=toLast;
  anchorRef.current=undefined;
  setChapter(nextChapter);setPage(0);setPages(1);setMeasuredKey('');
 };
 function next(){
  if(!ready)return;
  if(page<pages-1)setReaderPage(page+1);
  else if(chapter<chapters.length-1)switchChapter(chapter+1);
 }
 function prev(){
  if(!ready)return;
  if(page>0)setReaderPage(page-1);
  else if(chapter>0)switchChapter(chapter-1,true);
 }
 const style={
  '--font-size':settings.fontSize+'px',
  '--line-height':String(settings.lineHeight),
  '--reading-font':fontStack(settings.fontFamily),
  '--indent':settings.paragraphIndent+'em',
  '--page-height':geometry.height+'px',
  '--align':'left',
  '--word-spacing':settings.wordSpacing+'px',
  '--letter-spacing':settings.letterSpacing+'px',
  '--paragraph-spacing':settings.paragraphSpacing+'px',
  '--font-weight':String(settings.fontWeight),
  '--hyphenation':settings.hyphenation
 } as React.CSSProperties;
 const actualChapter=chapters[chapter];
 const position:ReaderPosition={chapter,page,fraction:pages>1?page/(pages-1):0,
  anchor:anchorRef.current,updatedAt:Date.now()};
 return <ReadingControls book={book} settings={settings} onSettings={onSettings} onBack={onBack} onNext={next} onPrevious={prev}
  position={position} progress={progressOf(chapter,page,pages,chapters.length)}
  caption={ready?'Страница '+(page+1)+' из '+pages:'Открываем книгу'}
  chapters={chapters} currentChapter={chapter} onChapter={index=>switchChapter(index)} interactiveContent>
  {error?<div className="reader-message">{error}</div>:<div className="page-region" style={{paddingLeft:settings.margin,paddingRight:settings.marginRight,
   top:`calc(env(safe-area-inset-top) + ${settings.verticalMargin}px)`,
   bottom:`calc(env(safe-area-inset-bottom) + ${settings.bottomMargin}px)`}}>
   <div className="page-viewport" ref={viewport} style={style}>
    {actualChapter&&geometry.width>0?<div ref={flow} key={chapter} data-column-stride={stride||geometry.width+GAP} className={'book-flow '+(settings.animation==='none'||reflowing?'no-animation':'')}
     lang="ru" style={{width:geometry.width,height:geometry.height,columnWidth:geometry.width,columnGap:GAP,
      transform:'translate3d(-'+(page*(stride||geometry.width+GAP))+'px,0,0)'}}>
     {actualChapter.blocks.map((block,index)=><BookBlock key={index} block={block} index={index} onMediaLoaded={()=>setMediaVersion(v=>v+1)} onOpenTable={setExpandedTable}/>)}
    </div>:<div className="book-loading">Открываем книгу…</div>}
   </div>
  </div>}
  {expandedTable&&<div className="book-table-overlay" role="presentation">
   <section className="book-table-panel" role="dialog" aria-modal="true" aria-label="Таблица книги">
    <header><strong>Таблица · {expandedTable.length} строк</strong><button onClick={()=>setExpandedTable(null)} aria-label="Закрыть таблицу">Готово</button></header>
    <div className="book-table-scroll"><table><tbody>{expandedTable.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>
   </section>
  </div>}
 </ReadingControls>;
}
