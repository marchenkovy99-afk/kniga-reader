import { useEffect, useRef, useState } from 'react';
import type { ReaderSettings, StoredBook } from '../domain';
import { savePosition } from '../storage';
import { ReadingControls } from '../components/ReadingControls';
import { applyEpubAppearance } from './epubAppearance';

type Props={book:StoredBook;settings:ReaderSettings;onSettings:(s:ReaderSettings)=>void;onBack:()=>void};
export function EpubReader({book,settings,onSettings,onBack}:Props){
 const host=useRef<HTMLDivElement>(null),rendition=useRef<any>(null);
 const lastCfi=useRef(book.position?.cfi||'');
 const currentAppearance=useRef(settings);
 currentAppearance.current=settings;
 const [error,setError]=useState(''),[progress,setProgress]=useState(Math.round((book.position?.fraction||0)*100));
 const [location,setLocation]=useState(book.position?.cfi||'');
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
       rend.themes.default({body:{margin:'0',padding:'0'},p:{'margin-bottom':'var(--libra-paragraph-gap, 0px)','text-indent':'var(--libra-paragraph-indent, 1em)'}});
       applyEpubAppearance(rend.themes,currentAppearance.current);
       rend.on('relocated',(loc:any)=>{
         if(cancelled)return;
         const cfi=loc?.start?.cfi;
         if(typeof cfi!=='string'||!cfi)return;
         setLocation(cfi);lastCfi.current=cfi;
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
 },[settings.theme,settings.fontSize,settings.lineHeight,settings.fontFamily,settings.margin,settings.align,settings.wordSpacing,settings.letterSpacing,settings.paragraphSpacing,settings.paragraphIndent,settings.verticalMargin]);
 return <ReadingControls book={book} settings={settings} onSettings={onSettings} onBack={onBack}
  onNext={()=>void rendition.current?.next()} onPrevious={()=>void rendition.current?.prev()}
  position={{chapter:0,page:0,fraction:progress/100,cfi:location,updatedAt:Date.now()}}
  progress={progress} caption="EPUB">
  {error?<div className="reader-message">{error}</div>:<div className="epub-mount" ref={host}/>}
 </ReadingControls>;
}
