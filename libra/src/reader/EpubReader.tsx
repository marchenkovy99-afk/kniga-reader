import { useEffect, useRef, useState } from 'react';
import type { ReaderSettings, StoredBook } from '../domain';
import { savePosition } from '../storage';
import { ReadingControls } from '../components/ReadingControls';
import { applyEpubAppearance } from './epubAppearance';
import { chapterForHref, flattenEpubToc, type EpubChapter } from './epubNavigation';

const typographyKey=(s:ReaderSettings)=>JSON.stringify([s.fontSize,s.lineHeight,s.fontFamily,s.margin,s.marginRight,s.verticalMargin,s.bottomMargin,s.align,s.wordSpacing,s.letterSpacing,s.paragraphSpacing,s.paragraphIndent,s.fontWeight,s.hyphenation]);
type Props={book:StoredBook;settings:ReaderSettings;onSettings:(s:ReaderSettings)=>void;onBack:()=>void};
export function EpubReader({book,settings,onSettings,onBack}:Props){
 const epubRef=useRef<any>(null);
 const [locationCount,setLocationCount]=useState(0);
 const [contentPage,setContentPage]=useState(1);
 const host=useRef<HTMLDivElement>(null),rendition=useRef<any>(null);
 const lastCfi=useRef(book.position?.cfi||'');
 const currentAppearance=useRef(settings);
 const appliedTypography=useRef(typographyKey(settings));
 const savedFraction=useRef(book.position?.fraction||0);
 const locationsReady=useRef(false),atBookEnd=useRef(false);
 const explicitTarget=useRef<{page:number;cfi:string}|null>(null);
 const clearTarget=()=>{explicitTarget.current=null};
 currentAppearance.current=settings;
 const [error,setError]=useState(''),[progress,setProgress]=useState(Math.round((book.position?.fraction||0)*100));
 const [location,setLocation]=useState(book.position?.cfi||'');
 const [chapters,setChapters]=useState<EpubChapter[]>([]);
 const [currentChapter,setCurrentChapter]=useState(0);
 // The book and its iframes must outlive theme and typography changes:
 // recreating epub.js on every slider event can lose the current CFI.
 useEffect(()=>{
   let cancelled=false,epub:any,rend:any;
   locationsReady.current=false;explicitTarget.current=null;
   async function mount(){
     try{
       const {default:ePub}=await import('epubjs');
       if(cancelled||!host.current)return;
       epub=ePub(await book.file.arrayBuffer());epubRef.current=epub;
       if(cancelled||!host.current)return;
       rend=epub.renderTo(host.current,{width:'100%',height:'100%',flow:'paginated',spread:'none',allowScriptedContent:false});
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
       appliedTypography.current=typographyKey(currentAppearance.current);
       const navigation=await epub.loaded.navigation;
       if(cancelled)return;
       const items=flattenEpubToc(navigation?.toc||[]);
       setChapters(items);
       const persist=(actualCfi:string,end:boolean)=>{
        const count=locationsReady.current?epub.locations.length():0;
        const target=explicitTarget.current;
        const cfi=target?.cfi||actualCfi;
        const index=count?epub.locations.locationFromCfi(cfi):-1;
        const selected=target?.page||(end?count:index+1);
        const fraction=count>1?(target?(target.page-1)/(count-1):end?1:Math.max(0,Math.min(1,index/(count-1)))):
         end?1:savedFraction.current;
        if(count&&selected>0)setContentPage(selected);
        setLocation(cfi);lastCfi.current=cfi;
        savedFraction.current=fraction;setProgress(Math.round(fraction*100));
        void savePosition(book.id,{chapter:0,page:0,fraction,cfi,updatedAt:Date.now()}).catch(console.error);
       };
       rend.on('relocated',(loc:any)=>{
        if(cancelled)return;
        const cfi=loc?.start?.cfi;
        if(typeof cfi!=='string'||!cfi)return;
        atBookEnd.current=Boolean(loc.atEnd);
        setCurrentChapter(chapterForHref(loc?.start?.href,items));
        persist(cfi,atBookEnd.current);
       });
       await rend.display(lastCfi.current||undefined);
       // EPUB's stable text locations are conditional pages, independent of
       // font size; generating them also enables real whole-book seeking.
       void epub.locations.generate(1600).then(()=>{
        if(cancelled)return;
        locationsReady.current=true;
        setLocationCount(epub.locations.length());
        // Persist the restored position only after the complete book index
        // exists; partial location arrays do not describe whole-book progress.
        persist(lastCfi.current,atBookEnd.current);
       }).catch(()=>{});
     }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Не удалось открыть EPUB')}
   }
   void mount();
   return ()=>{
    cancelled=true;
    if(rendition.current===rend)rendition.current=null;
    if(epubRef.current===epub)epubRef.current=null;
    try{rend?.destroy()}catch{}
    try{epub?.destroy()}catch{}
   };
 },[book.id,book.file]);
 useEffect(()=>{
   const rend=rendition.current;if(!rend)return;
   applyEpubAppearance(rend.themes,settings);
   const key=typographyKey(settings);
   if(key!==appliedTypography.current){
    appliedTypography.current=key;
    // A changed font invalidates epub.js' cached view width and column
    // offsets. Recreate views in the same rendition and restore the CFI;
    // subsequent seek requests run after this display in its render queue.
    rend.clear();
    void rend.display(lastCfi.current||undefined).catch((e:unknown)=>setError(String(e)));
   }
 },[settings.theme,settings.fontSize,settings.lineHeight,settings.fontFamily,settings.margin,settings.align,settings.wordSpacing,settings.letterSpacing,settings.paragraphSpacing,settings.paragraphIndent,settings.verticalMargin,settings.marginRight,settings.bottomMargin,settings.fontWeight,settings.hyphenation]);
 return <ReadingControls book={book} settings={settings} onSettings={onSettings} onBack={onBack}
  onNext={()=>{clearTarget();void rendition.current?.next().catch((e:unknown)=>setError(String(e)))}}
  onPrevious={()=>{clearTarget();void rendition.current?.prev().catch((e:unknown)=>setError(String(e)))}}
  chapters={chapters.length?chapters:undefined} currentChapter={currentChapter}
  onChapter={index=>{clearTarget();const chapter=chapters[index];if(chapter)void rendition.current?.display(chapter.href).catch((e:unknown)=>setError(String(e)))}}
  position={{chapter:0,page:0,fraction:progress/100,cfi:location,updatedAt:Date.now()}}
  progress={progress} caption={locationCount?'Страница '+contentPage+' из '+locationCount:'Открываем EPUB'}
  pageNumber={locationCount?contentPage:undefined} totalPages={locationCount||undefined} conditionalPages
  chapterTitle={chapters[currentChapter]?.title}
  onPage={locationCount?number=>{
   const cfi=number>=locationCount?epubRef.current?.locations.cfiFromPercentage(1):
    epubRef.current?.locations.cfiFromLocation(Math.max(0,Math.min(locationCount-1,number-1)));
   if(typeof cfi==='string'){explicitTarget.current={page:number,cfi};void rendition.current?.display(cfi).catch((e:unknown)=>setError(String(e)));}
  }:undefined}>
  {error?<div className="reader-message">{error}</div>:<div className="epub-mount" ref={host}/>}
 </ReadingControls>;
}
