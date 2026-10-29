import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Block, Chapter, ReaderPosition, ReaderSettings, StoredBook } from '../domain';
import { parseFB2 } from '../fb2';
import { clampPage, measureColumns, progressOf, restoreFraction } from '../pagination';
import { savePosition } from '../storage';
import { ReadingControls } from '../components/ReadingControls';
const GAP=24;
function BookBlock({block}:{block:Block}){
  if(block.kind==='image')return <figure className="book-figure"><img src={block.src} alt={block.alt}/></figure>;
  if(block.kind==='table')return <table className="book-table"><tbody>{block.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table>;
  if(block.kind==='heading')return <h2 className="book-heading">{block.text}</h2>;
  if(block.kind==='verse')return <div className="book-verse">{block.text}</div>;
  return <p className="book-paragraph">{block.text}</p>;
}
type Props={book:StoredBook;settings:ReaderSettings;onSettings:(s:ReaderSettings)=>void;onBack:()=>void};
export function FB2Reader({book,settings,onSettings,onBack}:Props){
 const [chapters,setChapters]=useState<Chapter[]>([]);
 const [error,setError]=useState('');
 const [chapter,setChapter]=useState(book.position?.chapter||0);
 const [page,setPage]=useState(book.position?.page||0);
 const [pages,setPages]=useState(1);
 const [geometry,setGeometry]=useState({width:0,height:0});
 const viewport=useRef<HTMLDivElement>(null);
 const flow=useRef<HTMLDivElement>(null);
 const previous=useRef(false);
 const restored=useRef(false);
 useEffect(()=>{
   let cancelled=false;
   book.file.text().then(s=>parseFB2(s)).then(result=>{if(!cancelled)setChapters(result.chapters)})
     .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Не удалось открыть FB2')});
   return ()=>{cancelled=true};
 },[book.id,book.file]);
 useLayoutEffect(()=>{
   const el=viewport.current;if(!el)return;
   const recalc=()=>setGeometry({width:el.clientWidth,height:el.clientHeight});
   const observer=new ResizeObserver(recalc);observer.observe(el);recalc();
   return ()=>observer.disconnect();
 },[chapters.length]);
 useLayoutEffect(()=>{
   if(!flow.current||!geometry.width||!geometry.height)return;
   const el=flow.current;
   const compute=()=>{
     const count=measureColumns(el.scrollWidth,geometry.width,GAP);
     setPages(count);
     if(previous.current){previous.current=false;setPage(count-1)}
     else if(!restored.current&&book.position?.chapter===chapter){
       restored.current=true;setPage(clampPage(book.position.page,count));
     }else setPage(current=>clampPage(current,count));
   };
   const frame=requestAnimationFrame(compute);
   void document.fonts.ready.then(()=>requestAnimationFrame(compute));
   return ()=>cancelAnimationFrame(frame);
 },[chapters,chapter,geometry.width,geometry.height,settings.fontSize,settings.lineHeight,settings.margin,settings.fontFamily,settings.align,settings.paragraphIndent,book.position]);
 useEffect(()=>{
   if(!chapters.length)return;
   const position:ReaderPosition={chapter,page,fraction:pages>1?page/(pages-1):0,updatedAt:Date.now()};
   const timer=window.setTimeout(()=>{void savePosition(book.id,position)},250);
   return ()=>clearTimeout(timer);
 },[book.id,chapter,page,pages,chapters.length]);
 function next(){if(page<pages-1)setPage(p=>p+1);else if(chapter<chapters.length-1){setChapter(c=>c+1);setPage(0)}}
 function prev(){if(page>0)setPage(p=>p-1);else if(chapter>0){previous.current=true;setChapter(c=>c-1)}}
 function goTo(index:number){previous.current=false;setChapter(index);setPage(0)}
 const style={
  '--font-size':settings.fontSize+'px',
  '--line-height':String(settings.lineHeight),
  '--reading-font':settings.fontFamily==='serif'?'\"Iowan Old Style\", \"Palatino Linotype\", Georgia, serif':'-apple-system, BlinkMacSystemFont, sans-serif',
  '--indent':settings.paragraphIndent+'em',
  '--page-height':geometry.height+'px',
  '--align':settings.align
 } as React.CSSProperties;
 const actualChapter=chapters[chapter];
 const position={chapter,page,fraction:pages>1?page/(pages-1):0,updatedAt:Date.now()};
 return <ReadingControls book={book} settings={settings} onSettings={onSettings} onBack={onBack} onNext={next} onPrevious={prev}
   position={position} progress={progressOf(chapter,page,pages,chapters.length)}
   caption={chapters.length?'Страница '+(page+1)+' из '+pages:'Открываем книгу'}
   chapters={chapters} currentChapter={chapter} onChapter={goTo}>
   {error?<div className="reader-message">{error}</div>:<div className="page-region" style={{paddingInline:settings.margin}}>
    <div className="page-viewport" ref={viewport} style={style}>
      {actualChapter&&geometry.width>0?<div ref={flow} className={'book-flow '+(settings.animation==='none'?'no-animation':'')}
        lang="ru" style={{width:geometry.width, height:geometry.height, columnWidth:geometry.width,columnGap:GAP,
          transform:'translate3d(-'+(page*(geometry.width+GAP))+'px,0,0)'}}>
          {actualChapter.blocks.map((block,i)=><BookBlock key={i} block={block}/>)}
        </div>:<div className="book-loading">Открываем книгу…</div>}
    </div>
   </div>}
 </ReadingControls>;
}
