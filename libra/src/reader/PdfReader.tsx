import { useEffect, useRef, useState } from 'react';
import type { ReaderPosition, ReaderSettings, StoredBook } from '../domain';
import { savePosition } from '../storage';
import { ReadingControls } from '../components/ReadingControls';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
type Props={book:StoredBook;settings:ReaderSettings;onSettings:(s:ReaderSettings)=>void;onBack:()=>void};
export function PdfReader({book,settings,onSettings,onBack}:Props){
 const [document,setDocument]=useState<any>(null),[count,setCount]=useState(1),[page,setPage]=useState((book.position?.page||0)+1),[error,setError]=useState('');
 const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
 // A canvas cannot be rendered into by two PDF.js tasks at once.
 // Serialize *all* page and resize paints, even across effect cleanups.
 const painting=useRef<Promise<void>>(Promise.resolve());
 const activeTask=useRef<any>(null);
 useEffect(()=>{
   let cancelled=false,task:any;
   async function open(){
     try{
       const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
       if(cancelled)return;
       pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
       task=pdfjs.getDocument({data:new Uint8Array(await book.file.arrayBuffer())});
       const loaded=await task.promise;
       if(!cancelled){
        setDocument(loaded);setCount(loaded.numPages);
        setPage(p=>Math.min(Math.max(1,p),loaded.numPages));
       }
     }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Не удалось открыть PDF')}
   }void open();
   return ()=>{cancelled=true;if(task)void task.destroy().catch(()=>{})};
 },[book.id,book.file]);
 useEffect(()=>{
   if(!document||!canvas.current||!container.current)return;
   let disposed=false,revision=0;
   const paint=()=>{
     const wanted=++revision;
     // Cancelling the old render is not sufficient: PDF.js releases the
     // canvas only after its RenderTask.promise settles.
     activeTask.current?.cancel();
     const next=painting.current.catch(()=>{}).then(async()=>{
       if(disposed||wanted!==revision||!canvas.current||!container.current)return;
       const source=await document.getPage(page);
       if(disposed||wanted!==revision||!canvas.current||!container.current)return;
       const bounds=container.current.getBoundingClientRect();
       if(bounds.width<=20||bounds.height<=20)return;
       const natural=source.getViewport({scale:1});
       const scale=Math.min((bounds.width-20)/natural.width,(bounds.height-20)/natural.height);
       const dpi=Math.max(1,Math.min(window.devicePixelRatio||1,2));
       // Never clamp the scale upward: very large PDFs can require a scale
       // below 0.1 to fit the canvas without losing page edges.
       if(!Number.isFinite(scale)||scale<=0)return;
       const view=source.getViewport({scale});
       const visible=canvas.current;
       visible.width=Math.ceil(view.width*dpi);visible.height=Math.ceil(view.height*dpi);
       visible.style.width=view.width+'px';visible.style.height=view.height+'px';
       const context=visible.getContext('2d');if(!context)return;
       const task=source.render({canvas:visible,canvasContext:context,viewport:view,transform:[dpi,0,0,dpi,0,0]});
       activeTask.current=task;
       try{await task.promise}
       catch(e){
        if(!disposed&&wanted===revision&&!(e instanceof Error&&e.name==='RenderingCancelledException'))
         setError('Ошибка отображения страницы PDF');
       }finally{if(activeTask.current===task)activeTask.current=null}
     }).catch(e=>{
       if(!disposed&&wanted===revision)setError(e instanceof Error?e.message:'Ошибка отображения страницы PDF');
     });
     painting.current=next;
   };
   const observer=new ResizeObserver(paint);
   observer.observe(container.current);
   paint();
   return ()=>{
    disposed=true;revision++;
    observer.disconnect();activeTask.current?.cancel();
   };
 },[document,page]);
 useEffect(()=>{
   if(document)void savePosition(book.id,{chapter:0,page:page-1,fraction:page/count,updatedAt:Date.now()}).catch(console.error);
 },[book.id,page,count,document]);
 const position:ReaderPosition={chapter:0,page:page-1,fraction:page/count,updatedAt:Date.now()};
 return <ReadingControls book={book} settings={settings} onSettings={onSettings} onBack={onBack}
   onNext={()=>setPage(p=>Math.min(count,p+1))} onPrevious={()=>setPage(p=>Math.max(1,p-1))}
   position={position} progress={Math.round(page/count*100)} caption={'Страница '+page+' из '+count}>
   {error?<div className="reader-message">{error}</div>:<div className="pdf-page" ref={container}><canvas ref={canvas} aria-label={'PDF, страница '+page}/></div>}
 </ReadingControls>;
}
