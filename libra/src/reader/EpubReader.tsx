import { useEffect, useRef, useState } from 'react';
import type { ReaderSettings, StoredBook } from '../domain';
import { savePosition } from '../storage';
import { ReadingControls } from '../components/ReadingControls';
import { applyEpubAppearance } from './epubAppearance';
import { chapterForHref, flattenEpubToc, type EpubChapter } from './epubNavigation';

type Props={book:StoredBook;settings:ReaderSettings;onSettings:(s:ReaderSettings)=>void;onBack:()=>void};
export function EpubReader({book,settings,onSettings,onBack}:Props){
 const host=useRef<HTMLDivElement>(null),rendition=useRef<any>(null);
 const lastCfi=useRef(book.position?.cfi||'');
 const currentAppearance=useRef(settings);
 currentAppearance.current=settings;
 const [error,setError]=useState(''),[progress,setProgress]=useState(Math.round((book.position?.fraction||0)*100));
 const [location,setLocation]=useState(book.position?.cfi||'');
 const [chapters,setChapters]=useState<EpubChapter[]>([]);
 const [currentChapter,setCurrentChapter]=useState(0);
 // The book and its iframes must outlive theme and typography changes:
 // recreating epub.js on every slider event can lose the current CFI.
 useEffect(()=>{
   let cancelled=false,epub:any,rend:any;
   async function mount(){
     try{
       const {default:ePub}=await import('epubjs');
       if(cancelled||!host.current)return;
       epub=ePub(await book.file.arrayBuffer());
       if(cancelled||!host.current)return;
       rend=epub.renderTo(host.current,{width:'100%',height:'100%',flow:'paginated',spread:'none'});
       rendition.current=rend;
       // The default stylesheet is injected into future chapters as they load.
       rend.themes.default({
        body:{margin:'0',padding:'0','overflow-wrap':'anywhere'},
        p:{'margin-bottom':'var(--libra-paragraph-gap, 0px)','text-indent':'var(--libra-paragraph-indent, 1em)'},
        img:{'max-width':'100%','max-height':'90vh',width:'auto',height:'auto','object-fit':'contain'},
        svg:{'max-width':'100%',height:'auto'},
        table:{'max-width':'100%','table-layout':'fixed','overflow-wrap':'anywhere'},
        'td,th':{'overflow-wrap':'anywhere','word-break':'normal'},
        pre:{'white-space':'pre-wrap','overflow-wrap':'anywhere'}
       });
       applyEpubAppearance(rend.themes,currentAppearance.current);
       const navigation=await epub.loaded.navigation;
       if(cancelled)return;
       const items=flattenEpubToc(navigation?.toc||[]);
       setChapters(items);
       rend.on('relocated',(loc:any)=>{
         if(cancelled)return;
         const cfi=loc?.start?.cfi;
         if(typeof cfi!=='string'||!cfi)return;
         setLocation(cfi);lastCfi.current=cfi;
         setCurrentChapter(chapterForHref(loc?.start?.href,items));
         const fraction=Number.isFinite(loc?.start?.percentage)?
          Math.max(0,Math.min(1,loc.start.percentage)):
          0;
         setProgress(Math.round(fraction*100));
         void savePosition(book.id,{chapter:0,page:0,fraction,cfi,updatedAt:Date.now()}).catch(console.error);
       });
       await rend.display(lastCfi.current||undefined);
     }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Не удалось открыть EPUB')}
   }
   void mount();
   return ()=>{
    cancelled=true;
    if(rendition.current===rend)rendition.current=null;
    try{rend?.destroy()}catch{}
    try{epub?.destroy()}catch{}
   };
 },[book.id,book.file]);
 useEffect(()=>{
   if(rendition.current)applyEpubAppearance(rendition.current.themes,settings);
 },[settings.theme,settings.fontSize,settings.lineHeight,settings.fontFamily,settings.margin,settings.align,settings.wordSpacing,settings.letterSpacing,settings.paragraphSpacing,settings.paragraphIndent,settings.verticalMargin,settings.marginRight,settings.bottomMargin,settings.fontWeight,settings.hyphenation]);
 return <ReadingControls book={book} settings={settings} onSettings={onSettings} onBack={onBack}
  onNext={()=>{void rendition.current?.next().catch((e:unknown)=>setError(String(e)))}}
  onPrevious={()=>{void rendition.current?.prev().catch((e:unknown)=>setError(String(e)))}}
  chapters={chapters.length?chapters:undefined} currentChapter={currentChapter}
  onChapter={index=>{const chapter=chapters[index];if(chapter)void rendition.current?.display(chapter.href).catch((e:unknown)=>setError(String(e)))}}
  position={{chapter:0,page:0,fraction:progress/100,cfi:location,updatedAt:Date.now()}}
  progress={progress} caption="EPUB">
  {error?<div className="reader-message">{error}</div>:<div className="epub-mount" ref={host}/>}
 </ReadingControls>;
}
