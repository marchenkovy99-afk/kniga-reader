import { useEffect, useRef, useState } from 'react';
import type { ReaderPosition, ReaderSettings, StoredBook } from '../domain';
import { PALETTES } from '../theme';
import { savePosition } from '../storage';
import { ReadingControls } from '../components/ReadingControls';
type Props={book:StoredBook;settings:ReaderSettings;onSettings:(s:ReaderSettings)=>void;onBack:()=>void};
export function EpubReader({book,settings,onSettings,onBack}:Props){
 const host=useRef<HTMLDivElement>(null),rendition=useRef<any>(null);
 const [error,setError]=useState(''),[progress,setProgress]=useState(0),[location,setLocation]=useState(book.position?.cfi||'');
 useEffect(()=>{
   let cancelled=false,epub:any,rend:any;
   async function mount(){
     try{
       const {default:ePub}=await import('epubjs');
       if(cancelled||!host.current)return;
       epub=ePub(await book.file.arrayBuffer());
       rend=epub.renderTo(host.current,{width:'100%',height:'100%',flow:'paginated',spread:'none'});
       rendition.current=rend;
       const p=PALETTES[settings.theme];
       rend.themes.default({body:{background:p.background,color:p.text,fontSize:settings.fontSize+'px',lineHeight:String(settings.lineHeight),
         fontFamily:settings.fontFamily==='serif'?'Georgia,serif':'Arial,sans-serif',
         textAlign:settings.align,padding:'0 '+settings.margin+'px',hyphens:'auto'}});
       rend.on('relocated',(loc:any)=>{
         if(cancelled)return;
         const cfi=loc?.start?.cfi||'';
         setLocation(cfi);
         const percent=Math.round((loc?.start?.percentage||0)*100);
         setProgress(percent);
         void savePosition(book.id,{chapter:0,page:0,fraction:percent/100,cfi,updatedAt:Date.now()});
       });
       await rend.display(book.position?.cfi||undefined);
     }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Не удалось открыть EPUB')}
   }
   void mount();
   return ()=>{cancelled=true;rendition.current=null;try{rend?.destroy()}catch{}try{epub?.destroy()}catch{}};
 },[book.id,book.file,settings.theme,settings.fontSize,settings.lineHeight,settings.fontFamily,settings.margin,settings.align]);
 return <ReadingControls book={book} settings={settings} onSettings={onSettings} onBack={onBack}
  onNext={()=>void rendition.current?.next()} onPrevious={()=>void rendition.current?.prev()}
  position={{chapter:0,page:0,fraction:progress/100,cfi:location,updatedAt:Date.now()}}
  progress={progress} caption="EPUB">
  {error?<div className="reader-message">{error}</div>:<div className="epub-mount" ref={host}/>}
 </ReadingControls>;
}
