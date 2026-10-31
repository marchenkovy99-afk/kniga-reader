import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Block, Chapter, ReaderPosition, ReaderSettings, StoredBook } from '../domain';
import type { FB2Anchor } from '../anchors';
import { getAnchorPage, getPageAnchor } from '../anchors';
import { loadParsedFB2 } from './parsedFB2Cache';
import { clampPage, restoreChapter, measureRenderedPages, measureColumnStride, progressOf } from '../pagination';
import { savePosition } from '../storage';
import { ReadingControls } from '../components/ReadingControls';
import { fontStack,readingInk } from '../readerSettings';
import { bookPageLocation,bookPageNumber,chapterStartPages,stableBookPageNumber,restoredFB2Page,rebaseFB2Position } from '../bookPagination';
import { inspectTextColumns, inspectCurrentColumn, invalidateTextColumnAudit, observeTextColumnChanges, type ClipIssue } from '../clippingGuard';
import { ClippingAlert } from '../components/ClippingAlert';
import {captureFB2Quote} from '../quoteSelection';
import {traceReading} from '../readingDiagnostics';

const GAP=24;
function BookBlock({block,index,forceTableDialog,onMediaLoaded,onOpenTable}:{block:Block;index:number;forceTableDialog:boolean;onMediaLoaded:()=>void;onOpenTable:(rows:string[][])=>void}){
 const oversized=block.kind==='table'&&(forceTableDialog||block.rows.length>9||block.rows.some(row=>row.join(' ').length>300)||block.rows.flat().join(' ').length>1100);
 if(block.kind==='image')return <figure data-block-index={index} className="book-figure">{block.src?<img src={block.src} alt={block.alt} onLoad={onMediaLoaded} onError={onMediaLoaded}/>:<span className="book-image-missing" role="note">{block.alt}</span>}</figure>;
 if(block.kind==='table'){
  if(oversized)return <button data-block-index={index} className="book-table-launch" onClick={()=>onOpenTable(block.rows)}>Большая таблица · {block.rows.length} строк <span>Открыть полностью ↗</span></button>;
  return <table data-block-index={index} className="book-table"><tbody>{block.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table>;
 }
 if(block.kind==='heading')return <h2 data-block-index={index} className="book-heading">{block.text}</h2>;
 if(block.kind==='verse')return <div data-block-index={index} className="book-verse">{block.text}</div>;
 return <p data-block-index={index} className="book-paragraph">{block.text}</p>;
}
/** Measure one chapter per frame using exactly the visible page's typography.
 * This probe is inert, offscreen and never part of the accessibility tree. */
function ChapterMeasure({chapter,width,height,style,onCount}:{chapter:Chapter;width:number;height:number;style:React.CSSProperties;onCount:(count:number)=>void}){
 const ref=useRef<HTMLDivElement>(null);
 const [tables,setTables]=useState<Set<number>>(()=>new Set());
 useLayoutEffect(()=>{
  let active=true;
  const el=ref.current;if(!el)return;
  const measure=()=>{
   if(!active)return;
   const oversized=Array.from(el.querySelectorAll<HTMLTableElement>('table.book-table'))
    .filter(t=>Array.from(t.rows).some(row=>row.getBoundingClientRect().height>height-16))
    .map(t=>Number(t.dataset.blockIndex)).filter(index=>!tables.has(index));
   if(oversized.length){setTables(old=>new Set([...old,...oversized]));return;}
   const stride=measureColumnStride(el,width,GAP);
   onCount(measureRenderedPages(el,width,GAP,stride));
  };
  // Wait for intrinsic image sizes before accepting the page count.
  const images=Array.from(el.querySelectorAll('img'));
  void Promise.all([document.fonts.ready,...images.map(img=>img.decode().catch(()=>{}))])
   .then(()=>{if(active)requestAnimationFrame(measure)});
  return ()=>{active=false};
 },[chapter,width,height,style,tables,onCount]);
 return <div className="chapter-measure" aria-hidden="true" inert style={style}>
  <div className="book-measure-flow" ref={ref} lang="ru" style={{width,height,columnWidth:width,columnGap:GAP}}>
   {chapter.blocks.map((block,index)=><BookBlock key={index} block={block} index={index} forceTableDialog={tables.has(index)} onMediaLoaded={()=>{}} onOpenTable={()=>{}}/>)}
  </div>
 </div>;
}
type Props={book:StoredBook;settings:ReaderSettings;onSettings:(s:ReaderSettings)=>void;onBack:()=>void};
export function FB2Reader({book,settings,onSettings,onBack}:Props){
 const [chapters,setChapters]=useState<Chapter[]>([]);
 const [error,setError]=useState('');
 const [clipIssue,setClipIssue]=useState<ClipIssue|null>(null);
 const [retryVersion,setRetryVersion]=useState(0);
 const [chapter,setChapter]=useState(book.position?.chapter||0);
 useEffect(()=>{setClipIssue(null);setRetryVersion(v=>v+1)},[settings,chapter]);
 const [page,setPage]=useState(book.position?.page||0);
 const [pages,setPages]=useState(1);
 const [stride,setStride]=useState(0);
 const [geometry,setGeometry]=useState({width:0,height:0});
 const [measuredKey,setMeasuredKey]=useState('');
 const [mediaVersion,setMediaVersion]=useState(0);
 const [reflowing,setReflowing]=useState(false);
 // Reuse the saved book-wide pagination when reopening the same layout.
 // Otherwise background reindexing can make page 288 display as 286.
 const [pageIndex,setPageIndex]=useState<{key:string;counts:Record<number,number>}>(()=>{
  const saved=book.position;
  if(!saved?.layoutKey||!saved.pageCounts?.length)return {key:'',counts:{}};
  return {key:saved.layoutKey.slice(saved.layoutKey.indexOf(':')+1),
   counts:Object.fromEntries(saved.pageCounts.map((count,i)=>[i,count]))};
 });
 const requestedPage=useRef<number|undefined>(undefined);
 const [expandedTable,setExpandedTable]=useState<string[][]|null>(null);
 // Some table rows are unbreakable in WebKit columns. Move a row that is
 // taller than the reading column into the full-content table viewer.
 const [tableLayout,setTableLayout]=useState<{key:string;indices:Set<number>}>(()=>({key:'',indices:new Set()}));
 const viewport=useRef<HTMLDivElement>(null);
 const flow=useRef<HTMLDivElement>(null);
 // Keep the outgoing page on screen while the next chapter's columns are
 // being measured. Otherwise WebKit paints provisional columns/offsets
 // on several consecutive frames, which looks like a horizontal jump.
 const frozenPage=useRef<HTMLDivElement|null>(null);
 const clearFrozenPage=()=>{
  frozenPage.current?.remove();
  frozenPage.current=null;
 };
 const freezeVisiblePage=()=>{
  if(frozenPage.current||!viewport.current||!flow.current)return;
  const overlay=document.createElement('div');
  overlay.className='chapter-page-freeze';
  overlay.setAttribute('aria-hidden','true');
  overlay.setAttribute('inert','');
  const clone=flow.current.cloneNode(true) as HTMLDivElement;
  clone.classList.add('no-animation');
  clone.style.transition='none';
  overlay.appendChild(clone);
  viewport.current.appendChild(overlay);
  frozenPage.current=overlay;
 };
 const previous=useRef(false);
 const returnToChapterEnd=useRef(false);
 const chapterCommit=useRef<{chapter:number;requestedBookPage?:number}|null>(null);
 const anchorRef=useRef<FB2Anchor|undefined>(book.position?.anchor);
 const lastPosition=useRef<ReaderPosition|undefined>(book.position);
 // The initial saved physical page wins over a premature Safari reflow.
 const restoringSavedPage=useRef(Boolean(book.position));
 // Rebase only the column index after an asynchronous WebKit reflow.
 const restoreByAnchor=useRef(false);
 const nextPositionTime=()=>Math.max(Date.now(),(lastPosition.current?.updatedAt??0)+1);
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
    restoringSavedPage.current=false;
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
 const nonfittingTables=tableLayout.key===layoutKey?tableLayout.indices:new Set<number>();
 useLayoutEffect(()=>{
  if(clipIssue||!flow.current||!geometry.width||!geometry.height)return;
  let active=true;
  // A font/margin change is a re-layout, not a page turn. Animating from
  // the old column origin causes Safari to clip content mid-transition.
  // Regular user-initiated page flips retain their optional animation.
  // Never release the lock on a timer: a chapter's fonts/media or a slow
  // iPhone layout pass can finish after the old 360ms deadline.
  setReflowing(true);
  const compute=()=>{
   if(!active||!flow.current)return;
   const current=flow.current;
   const tooTall=Array.from(current.querySelectorAll<HTMLTableElement>('table.book-table'))
    .filter(table=>Array.from(table.rows).some(row=>row.getBoundingClientRect().height>geometry.height-16))
    .map(table=>Number(table.dataset.blockIndex))
    .filter(index=>Number.isSafeInteger(index)&&index>=0&&!nonfittingTables.has(index));
   if(tooTall.length){
    // Re-render the actual source table as a scrollable accessible dialog
    // before accepting this pagination layout. No cell text is thrown away.
    setMeasuredKey('');
    setTableLayout(old=>({key:layoutKey,indices:new Set([...(old.key===layoutKey?old.indices:[]),...tooTall])}));
    return;
   }
   const actualStride=measureColumnStride(current,geometry.width,GAP);
   invalidateTextColumnAudit(current);
   const issue=inspectTextColumns(current,{...geometry,stride:actualStride});
   if(issue){setClipIssue(issue);return;}
   const geo={width:geometry.width,gap:GAP,stride:actualStride};
   const count=measureRenderedPages(current,geometry.width,GAP,actualStride);
   setStride(old=>Math.abs(old-actualStride)<.01?old:actualStride);
   const anchored=anchorRef.current?getAnchorPage(current,anchorRef.current,geo):null;
   // Re-running measurements (fonts.ready, image loads, viewport changes)
   // must not undo an explicit chapter-boundary jump. Reuse the last page
   // until a precise source anchor is available.
   const explicitPage=requestedPage.current;
   const saved=lastPosition.current?.chapter===chapter?lastPosition.current:undefined;
   // Restore the source text if Safari's column count has changed.
   // The absolute page number must NOT fall by the reflow difference.
   const firstRestore=restoringSavedPage.current&&Boolean(saved);
   const savedChapterPages=saved?.pageCounts?.[chapter];
   const pageCountChanged=Boolean(savedChapterPages&&savedChapterPages!==count);
   const anchorPreferred=Boolean(saved&&(restoreByAnchor.current||
    saved.layoutKey!==layoutKey||saved.page>=count||pageCountChanged));
   const selected=explicitPage??(previous.current?count-1:
    restoredFB2Page(saved,layoutKey,count,anchored,anchorPreferred));
   traceReading('fb2.layout',{id:book.id,chapter,savedPage:saved?.page,savedGlobal:saved?.globalPage,
    selectedPage:selected,anchorPage:anchored??undefined,firstRestore,explicitPage,
    layoutMatches:saved?.layoutKey===layoutKey,anchorPreferred,pageCountChanged,columns:count,width:geometry.width,
    height:geometry.height,fontStatus:document.fonts.status});
   requestedPage.current=undefined;
   restoringSavedPage.current=false;
   const navigation=chapterCommit.current;
   if(saved&&!navigation&&explicitPage===undefined&&!previous.current){
    if(anchorPreferred&&anchored!==null)restoreByAnchor.current=true;
    // Rebase the physical column without persisting a false user page turn.
    // Preserve the exact book-wide page number and source anchor.
    lastPosition.current=rebaseFB2Position(saved,selected);
   }
   if(navigation?.chapter===chapter){
    // Only explicit navigation can persist progress; reflow and hydration cannot.
    const indexKey=layoutKey.slice(layoutKey.indexOf(':')+1);
    const cachedCounts=pageIndex.key===indexKey?pageIndex.counts:{};
    const allCounts=chapters.map((_,i)=>i===chapter?count:cachedCounts[i]||0);
    const indexed=allCounts.every(n=>n>0);
    const anchor=getPageAnchor(current,clampPage(selected,count),geo);
    if(anchor)anchorRef.current=anchor;
    const position:ReaderPosition={
     chapter,page:clampPage(selected,count),
     fraction:indexed?bookPageNumber(allCounts,chapter,selected)/allCounts.reduce((sum,n)=>sum+n,0):
      progressOf(chapter,selected,count,chapters.length)/100,
     anchor:anchorRef.current,layoutKey,updatedAt:nextPositionTime(),
     globalPage:navigation.requestedBookPage??(indexed?bookPageNumber(allCounts,chapter,selected):undefined),
     pageCounts:indexed?allCounts:lastPosition.current?.pageCounts
    };
    chapterCommit.current=null;
    traceReading('fb2.chapter.commit',{id:book.id,chapter,page:position.page,
     globalPage:position.globalPage,updatedAt:position.updatedAt});
    lastPosition.current=position;
    void savePosition(book.id,position).catch(console.error);
   }
   previous.current=false;
   setPages(count);setPage(clampPage(selected,count));setMeasuredKey(layoutKey);
   // Late image decoding or font readiness can change this count after all
   // background probes have finished. Always refresh the shared page index.
   const key=layoutKey.slice(layoutKey.indexOf(':')+1);
   setPageIndex(old=>{
    const counts=old.key===key?old.counts:{};
    return counts[chapter]===count?old:{key,counts:{...counts,[chapter]:count}};
   });
  };
  // Initial WebKit layout may still be using fallback fonts or undecoded images.
  // Do not consume a restored checkpoint in that provisional frame.
  let frame=0;
  const images=Array.from(flow.current.querySelectorAll('img'));
  void Promise.all([document.fonts.ready,...images.map(img=>img.decode().catch(()=>{}))])
   .then(()=>{if(!active)return;frame=requestAnimationFrame(()=>{
    if(!active)return;frame=requestAnimationFrame(compute);
   })});
  return ()=>{active=false;cancelAnimationFrame(frame)};
 },[chapters,chapter,geometry.width,geometry.height,layoutKey,mediaVersion,tableLayout,clipIssue,retryVersion]);
 const ready=Boolean(!clipIssue&&chapters[chapter]&&geometry.width>0&&geometry.height>0&&measuredKey===layoutKey);
 // Enable sliding only once the newly measured column has actually been
 // committed to the screen. This prevents the initial or final page from
 // animating across the entire chapter at a chapter boundary.
 useLayoutEffect(()=>{
  if(clipIssue||error){clearFrozenPage();return}
  if(!ready)return;
  let second=0;
  const first=requestAnimationFrame(()=>{
   second=requestAnimationFrame(()=>{
    // The destination's measured transform is now committed and painted.
    // Release the old visible page only at this stable frame boundary.
    clearFrozenPage();
    setReflowing(false);
   });
  });
  return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second)};
 },[ready,layoutKey,chapter,clipIssue,error]);
 useEffect(()=>()=>clearFrozenPage(),[]);
 // Check the displayed origin on every flip; a full glyph traversal is cached
 // until typography, source content, media or an external DOM mutation changes.
 useLayoutEffect(()=>{
  const root=flow.current,view=viewport.current;
  if(!ready||clipIssue||!root||!view)return;
  let frame=0;
  const audit=()=>{
   const actualStride=stride||geometry.width+GAP;
   const issue=inspectTextColumns(root,{...geometry,stride:actualStride})||inspectCurrentColumn(root,view,page,actualStride);
   if(issue)setClipIssue(issue);
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(audit)};
  const stop=observeTextColumnChanges(root,schedule);
  schedule();
  return ()=>{stop();cancelAnimationFrame(frame)};
 },[ready,clipIssue,page,stride,layoutKey]);
 useLayoutEffect(()=>{
  const view=viewport.current,content=flow.current;
  if(!view||!content)return;
  if(!clipIssue){view.scrollTop=0;return}
  // After a chapter switch to the preceding chapter, scrolling belongs to
  // the new chapter's *final* layout, not the previous chapter's scrollHeight.
  // A zero-time layout pass can still report the old height in WebKit.
  const showEnd=returnToChapterEnd.current;
  const block=anchorRef.current?.block;
  const target=block===undefined?null:content.querySelector<HTMLElement>(`[data-block-index="${block}"]`);
  const setScroll=()=>{
   if(viewport.current!==view||flow.current!==content)return;
   if(showEnd)view.scrollTop=view.scrollHeight;
   else if(target){
    const offset=target.offsetTop;
    view.scrollTop=offset<8?0:offset;
   }else view.scrollTop=0;
  };
  setScroll();
  const frame=requestAnimationFrame(setScroll);
  return ()=>cancelAnimationFrame(frame);
 },[clipIssue,chapter]);

 // Durable progress is written by page turns and measured chapter navigation
 // only. Background indexing, resizes and initial restoration never write.
 const setReaderPage=(target:number,requestedBookPage?:number)=>{
  if(!ready||!flow.current)return;
  const safe=clampPage(target,pages);
  const anchor=getPageAnchor(flow.current,safe,{width:geometry.width,gap:GAP,stride:stride||geometry.width+GAP});
  if(anchor)anchorRef.current=anchor;
  if(safe===page)return;
  restoreByAnchor.current=false;
  // Save synchronously at the tap, not only in the post-render effect.
  const previous=lastPosition.current;
  const measuredCounts=pageIndex.key===layoutKey.slice(layoutKey.indexOf(':')+1)?pageIndex.counts:{};
  const allCounts=chapters.map((_,i)=>i===chapter?pages:measuredCounts[i]||0);
  const fullyIndexed=allCounts.every(n=>n>0);
  const position:ReaderPosition={chapter,page:safe,
   fraction:progressOf(chapter,safe,pages,chapters.length)/100,
   anchor:anchorRef.current,layoutKey,updatedAt:nextPositionTime(),
   globalPage:requestedBookPage??(fullyIndexed?stableBookPageNumber(previous,allCounts,chapter,safe):
    previous?.chapter===chapter&&previous.globalPage?
      previous.globalPage+safe-previous.page:undefined),
   pageCounts:fullyIndexed?allCounts:previous?.pageCounts};
  lastPosition.current=position;
  traceReading('fb2.page.turn',{id:book.id,chapter,page:safe,globalPage:position.globalPage,
   updatedAt:position.updatedAt});
  void savePosition(book.id,position).catch(console.error);
  setPage(safe);
 };
 const switchChapter=(nextChapter:number,toLast=false,requestedBookPage?:number)=>{
  if(!chapters[nextChapter])return;
  // Until the new page is rendered, retain the outgoing confirmed checkpoint.
  freezeVisiblePage();
  setReflowing(true);
  const key=layoutKey.slice(layoutKey.indexOf(':')+1);
  const cached=pageIndex.key===key?pageIndex.counts[nextChapter]:undefined;
  const target=requestedPage.current??(toLast?Math.max(0,(cached||1)-1):0);
  restoreByAnchor.current=false;
  chapterCommit.current={chapter:nextChapter,requestedBookPage};
  traceReading('fb2.chapter.request',{id:book.id,from:chapter,to:nextChapter,target});
  previous.current=toLast;
  returnToChapterEnd.current=toLast;
  anchorRef.current=undefined;
  setTableLayout({key:'',indices:new Set()});setChapter(nextChapter);
  setPage(target);setPages(cached||1);setMeasuredKey('');
 };
 function next(){
  if(clipIssue){if(chapter<chapters.length-1)void switchChapter(chapter+1);return;}
  if(!ready)return;
  if(page<pages-1)setReaderPage(page+1);
  else if(chapter<chapters.length-1)switchChapter(chapter+1);
 }
 function prev(){
  if(clipIssue){if(chapter>0)void switchChapter(chapter-1,true);return;}
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
  '--align':settings.align,
  '--word-spacing':settings.wordSpacing+'px',
  '--letter-spacing':settings.letterSpacing+'px',
  '--paragraph-spacing':settings.paragraphSpacing+'px',
  '--font-weight':String(settings.fontWeight),
  '--hyphenation':settings.hyphenation,
  '--reading-ink':readingInk(settings)
 } as React.CSSProperties;
 const actualChapter=chapters[chapter];
 const indexKey=layoutKey.slice(layoutKey.indexOf(':')+1);
 const counts=pageIndex.key===indexKey?pageIndex.counts:{};
 const knownCounts={...counts,...(ready?{[chapter]:pages}:{})};
 const indexed=chapters.length>0&&chapters.every((_,i)=>knownCounts[i]>0);
 const pageCounts=chapters.map((_,i)=>knownCounts[i]||0);
 const chapterPages=chapterStartPages(pageCounts);
 const totalPages=indexed?pageCounts.reduce((sum,n)=>sum+n,0):0;
 const globalPage=indexed?stableBookPageNumber(lastPosition.current,pageCounts,chapter,page):0;
 const probeChapter=ready?chapters.findIndex((_,i)=>!knownCounts[i]):-1;
 const acceptCount=(target:number,count:number)=>{
  setPageIndex(old=>{
   const current=old.key===indexKey?old.counts:{};
   if(current[target]===count&&current[chapter]===pages)return old;
   return {key:indexKey,counts:{...current,[chapter]:pages,[target]:count}};
  });
 };
 const seekPage=(number:number)=>{
  if(!indexed||!ready)return;
  // The user's absolute page number is authoritative even if the preceding
  // chapters have been remeasured with a slightly different page count.
  const rawPage=bookPageNumber(pageCounts,chapter,page);
  const offset=globalPage-rawPage;
  const target=bookPageLocation(pageCounts,number-offset);
  if(target.chapter===chapter){setReaderPage(target.page,number);return;}
  requestedPage.current=target.page;
  void switchChapter(target.chapter,false,number);
 };
 // Keep the small reading-state record and library percentage book-wide.
 const bookProgress=indexed?Math.round(globalPage/totalPages*100):progressOf(chapter,page,pages,chapters.length);
 const position:ReaderPosition={chapter,page,fraction:bookProgress/100,
  anchor:anchorRef.current,updatedAt:Date.now()};
 return <ReadingControls book={book} settings={settings} onSettings={onSettings} onBack={onBack} onNext={next} onPrevious={prev}
  position={position} progress={bookProgress} safeMode={Boolean(clipIssue)}
  pageNumber={globalPage||undefined} totalPages={totalPages||undefined} onPage={indexed&&ready?seekPage:undefined}
  chapterTitle={actualChapter?.title}
  caption={clipIssue?'Глава с прокруткой':ready?'Страница '+(globalPage||page+1)+' из '+(totalPages||pages):'Открываем книгу'}
  chapters={chapters.map((item,i)=>({title:item.title,page:chapterPages[i]}))} currentChapter={chapter}
   quoteSelection={()=>captureFB2Quote(flow.current,position)} onChapter={index=>switchChapter(index)} interactiveContent modalContentOpen={Boolean(expandedTable)}>
  {clipIssue&&<ClippingAlert issue={clipIssue} onRetry={()=>{if(flow.current)invalidateTextColumnAudit(flow.current);setMeasuredKey('');setClipIssue(null);setRetryVersion(v=>v+1)}}/>}
  {error?<div className="reader-message">{error}</div>:<div className="page-region" style={{paddingLeft:settings.margin,paddingRight:settings.marginRight,
   top:`calc(var(--reader-safe-top) + var(--reader-top-clearance, 8px) + var(--clipping-alert-height, 0px) + ${settings.verticalMargin}px)`,
   bottom:`calc(var(--reading-bottom-inset) + ${settings.bottomMargin}px)`}}>
   <div className="page-viewport" data-ready={ready} ref={viewport} style={style}>
    {actualChapter&&geometry.width>0?<div ref={flow} key={chapter} data-column-stride={stride||geometry.width+GAP} className={'book-flow '+(settings.animation==='none'||reflowing?'no-animation':'')}
     lang="ru" style={{width:geometry.width,height:geometry.height,columnWidth:geometry.width,columnGap:GAP,
      visibility:ready||Boolean(clipIssue)?'visible':'hidden',
      transform:'translateX(-'+(page*(stride||geometry.width+GAP))+'px)'}}>
     {actualChapter.blocks.map((block,index)=><BookBlock key={index} block={block} index={index} forceTableDialog={!clipIssue&&nonfittingTables.has(index)} onMediaLoaded={()=>setMediaVersion(v=>v+1)} onOpenTable={setExpandedTable}/>)}
    </div>:<div className="book-loading">Открываем книгу…</div>}
   </div>
  </div>}
  {probeChapter>=0&&<ChapterMeasure key={indexKey+':'+probeChapter} chapter={chapters[probeChapter]} width={geometry.width} height={geometry.height} style={style} onCount={count=>acceptCount(probeChapter,count)}/>}
  {expandedTable&&<div className="book-table-overlay" role="presentation">
   <section className="book-table-panel" role="dialog" aria-modal="true" aria-label="Таблица книги">
    <header><strong>Таблица · {expandedTable.length} строк</strong><button onClick={()=>setExpandedTable(null)} aria-label="Закрыть таблицу">Готово</button></header>
    <div className="book-table-scroll"><table><tbody>{expandedTable.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>
   </section>
  </div>}
 </ReadingControls>;
}
