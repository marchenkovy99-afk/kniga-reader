import { useEffect, useRef, useState } from 'react';
import type { ReaderPosition, ReaderSettings, StoredBook } from '../domain';
import { savePosition } from '../storage';
import { ReadingControls } from '../components/ReadingControls';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
type Props={book:StoredBook;settings:ReaderSettings;onSettings:(s:ReaderSettings)=>void;onBack:()=>void};
export function PdfReader({book,settings,onSettings,onBack}:Props){
 const [document,setDocument]=useState<any>(null),[count,setCount]=useState(1),[page,setPage]=useState((book.position?.page||0)+1),[error,setError]=useState('');
 const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
 useEffect(()=>{
   let cancelled=false,task:any,loaded:any;
   async function open(){
     try{
       const pdfjs=await import('pdfjs-dist');
       pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
       task=pdfjs.getDocument({data:new Uint8Array(await book.file.arrayBuffer())});
       loaded=await task.promise;
       if(!cancelled){setDocument(loaded);setCount(loaded.numPages)}
     }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Не удалось открыть PDF')}
   }void open();
   return ()=>{cancelled=true;void task?.destroy?.().catch(()=>{});};
 },[book.id,book.file]);
 useEffect(()=>{
   if(!document||!canvas.current||!container.current)return;
   let disposed=false,renderTask:any;
   const paint=async()=>{
     try{
       const source=await document.getPage(page);
       if(disposed||!canvas.current||!container.current)return;
       const r=container.current.getBoundingClientRect();
       const natural=source.getViewport({scale:1});
       const scale=Math.min((r.width-20)/natural.width,(r.height-20)/natural.height);
       const scaleFactor=Math.max(1,Math.min(window.devicePixelRatio||1,2));
       const v=source.getViewport({scale:Math.max(.1,scale)});
       const c=canvas.current;
       c.width=Math.ceil(v.width*scaleFactor);c.height=Math.ceil(v.height*scaleFactor);
       c.style.width=v.width+'px';c.style.height=v.height+'px';
       const context=c.getContext('2d');if(!context)return;
       renderTask=source.render({canvas:c,canvasContext:context,viewport:v,transform:[scaleFactor,0,0,scaleFactor,0,0]});
       await renderTask.promise;
     }catch(e){if(!disposed&&!(e instanceof Error&&e.name==='RenderingCancelledException'))setError('Ошибка отображения страницы PDF')}
   };
   const observer=new ResizeObserver(()=>{if(renderTask)renderTask.cancel();void paint()});
   observer.observe(container.current);void paint();
   return ()=>{disposed=true;observer.disconnect();if(renderTask)renderTask.cancel()};
 },[document,page]);
 useEffect(()=>{
   if(document)void savePosition(book.id,{chapter:0,page:page-1,fraction:page/count,updatedAt:Date.now()});
 },[book.id,page,count,document]);
 const position:ReaderPosition={chapter:0,page:page-1,fraction:page/count,updatedAt:Date.now()};
 return <ReadingControls book={book} settings={settings} onSettings={onSettings} onBack={onBack}
   onNext={()=>setPage(p=>Math.min(count,p+1))} onPrevious={()=>setPage(p=>Math.max(1,p-1))}
   position={position} progress={Math.round(page/count*100)} caption={'Страница '+page+' из '+count}>
   {error?<div className="reader-message">{error}</div>:<div className="pdf-page" ref={container}><canvas ref={canvas} aria-label={'PDF, страница '+page}/></div>}
 </ReadingControls>;
}
