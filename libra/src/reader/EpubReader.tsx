import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {ReaderSettings,StoredBook,ReaderPosition} from '../domain';
import {traceReading} from '../readingDiagnostics';
import {savePosition} from '../storage';
import {ReadingControls} from '../components/ReadingControls';
import {ClippingAlert} from '../components/ClippingAlert';
import {inspectTextColumns,invalidateTextColumnAudit,observeTextColumnChanges,type ClipIssue} from '../clippingGuard';
import {applyEpubAppearance,applyEpubInk} from './epubAppearance';
import {chapterForHref,flattenEpubToc,epubTocStartPages,type EpubChapter} from './epubNavigation';
import {captureEpubQuote} from '../quoteSelection';
import {applyEpubSafety,setEpubDocumentSafety,configureEpub,EPUB_OPTIONS,epubTypographyKey,physicalPage,settleEpub} from './epubLayout';

type Props={book:StoredBook;settings:ReaderSettings;onSettings:(s:ReaderSettings)=>void;onBack:()=>void};
type View={index:number;page:number;total:number;cfi:string;href:string};
type Section={index:number;href:string};
export function EpubReader({book,settings,onSettings,onBack}:Props){
 const host=useRef<HTMLDivElement>(null),probeHost=useRef<HTMLDivElement>(null);
 const epub=useRef<any>(null),rendition=useRef<any>(null),live=useRef(false),busy=useRef(false);
 const lastCfi=useRef(book.position?.cfi||''),settingsRef=useRef(settings);settingsRef.current=settings;
 const lastConfirmed=useRef<ReaderPosition|undefined>(book.position);
 const nextPositionTime=()=>Math.max(Date.now(),(lastConfirmed.current?.updatedAt??0)+1);
 const queue=useRef<Promise<unknown>>(Promise.resolve());
 const userNavigationPending=useRef(false);
 const settledKey=useRef('');
 const [loaded,setLoaded]=useState(false),[error,setError]=useState('');
 const [geometry,setGeometry]=useState({width:0,height:0});
 const [chapters,setChapters]=useState<EpubChapter[]>([]),[spine,setSpine]=useState<Section[]>([]);
 const spineRef=useRef<Section[]>([]);
 const [view,setView]=useState<View>({index:book.position?.chapter||0,page:(book.position?.page||0)+1,total:1,cfi:lastCfi.current,href:''});
 const [currentChapter,setCurrentChapter]=useState(0);
 const [issue,setIssue]=useState<ClipIssue|null>(null),[safeMode,setSafeMode]=useState(false),[retry,setRetry]=useState(0);
 const safeRef=useRef(false);safeRef.current=safeMode;
 const [pageIndex,setPageIndex]=useState<{key:string;values:Record<number,number>}>({key:'',values:{}});
 const [tocLocations,setTocLocations]=useState<{key:string;values:Record<number,{index:number;page:number}>}>({key:'',values:{}});
 const pageIndexRef=useRef(pageIndex);pageIndexRef.current=pageIndex;
 const layoutKey=[geometry.width,geometry.height,epubTypographyKey(settings)].join(':');
 const keyRef=useRef(layoutKey);keyRef.current=layoutKey;
 const commitRef=useRef<(loc:any,confirmed?:boolean)=>void>(()=>{}),auditRef=useRef<()=>void>(()=>{});
 const enqueue=(task:()=>Promise<unknown>|void,confirmedNavigation=false)=>{
  if(confirmedNavigation)userNavigationPending.current=true;
  queue.current=queue.current.catch(()=>{}).then(async()=>{
   if(!live.current||!rendition.current)return;
   busy.current=true;
   try{
    await task();
    if(!live.current)return;
    // Durable checkpoint before settling WebKit iframes / fonts.
    if(confirmedNavigation)commitRef.current(rendition.current.currentLocation(),true);
    await settleEpub(rendition.current);
    if(!live.current)return;
    busy.current=false;
    commitRef.current(rendition.current.currentLocation(),confirmedNavigation);
    auditRef.current();
   }finally{busy.current=false;if(confirmedNavigation)userNavigationPending.current=false;}
  }).catch(e=>{if(live.current)setError(e instanceof Error?e.message:String(e))});
 };
 commitRef.current=(location:any,confirmedNavigation=false)=>{
  const selected=physicalPage(location);if(!selected.cfi||!live.current)return;
  lastCfi.current=selected.cfi;
  setView({...selected,href:location?.start?.href||''});
  setCurrentChapter(chapterForHref(location?.start?.href,chapters));
  if(!safeRef.current){
   const key=keyRef.current;
   setPageIndex(old=>{
    const values=old.key===key?old.values:{};
    return values[selected.index]===selected.total?old:{key,values:{...values,[selected.index]:selected.total}};
   });
  }
  const cached=pageIndexRef.current;
  const order=spineRef.current;
  const indexed=cached.key===keyRef.current&&order.length>0&&order.every(s=>cached.values[s.index]>0);
  const before=order.filter(s=>s.index<selected.index).reduce((n,s)=>n+(cached.values[s.index]||0),0);
  const total=order.reduce((n,s)=>n+(cached.values[s.index]||0),0);
  const fraction=indexed?Math.min(1,(before+selected.page)/Math.max(1,total)):(book.position?.fraction||0);
  if(confirmedNavigation){
   if(lastConfirmed.current?.cfi===selected.cfi)return;
   const position:ReaderPosition={chapter:selected.index,page:selected.page-1,
    fraction,cfi:selected.cfi,updatedAt:nextPositionTime()};
   lastConfirmed.current=position;
   traceReading('epub.page.navigation',{id:book.id,chapter:position.chapter,
    page:position.page,updatedAt:position.updatedAt});
   void savePosition(book.id,position).catch(console.error);
  }
 };
 auditRef.current=()=>{
  if(safeRef.current||!host.current||!rendition.current||busy.current||geometry.width<1||geometry.height<1)return;
  const r=rendition.current;
  if(settledKey.current!==keyRef.current||Math.abs(host.current.clientWidth-geometry.width)>1||Math.abs(host.current.clientHeight-geometry.height)>1)return;
  const layout=r.layout();
  if(Math.abs(layout.width-geometry.width)>1||Math.abs(layout.height-geometry.height)>1)return;
  for(const content of r.getContents?.()||[]){
   const body=content.document?.body as HTMLElement|undefined;if(!body)continue;
   const problem=inspectTextColumns(body,{width:geometry.width,height:geometry.height,stride:r.layout()?.delta||geometry.width,originLeft:0,originTop:0});
   if(problem){setIssue(problem);setSafeMode(true);return;}
  }
 };
 useLayoutEffect(()=>{
  if(!host.current)return;
  const el=host.current;
  const measure=()=>setGeometry(old=>old.width===el.clientWidth&&old.height===el.clientHeight?old:{width:el.clientWidth,height:el.clientHeight});
  const observer=new ResizeObserver(measure);observer.observe(el);measure();return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  live.current=true;let cancelled=false,ownRend:any,ownBook:any;const observers:Array<()=>void>=[];
  const selectionDocs=new WeakSet<Document>();
  const announceSelection=()=>window.dispatchEvent(new Event('libra-quote-selection'));
  async function mount(){
   try{
    const {default:ePub}=await import('epubjs');if(cancelled||!host.current)return;
    ownBook=ePub(await book.file.arrayBuffer());epub.current=ownBook;
    if(cancelled)return;
    ownRend=ownBook.renderTo(host.current,{...EPUB_OPTIONS,width:'100%',height:'100%'});rendition.current=ownRend;
    configureEpub(ownRend,settingsRef.current);
    ownRend.hooks.content.register((content:any)=>setEpubDocumentSafety(content.document,safeRef.current));
    ownRend.on('selected',announceSelection);
    ownRend.on('rendered',()=>{
     for(const c of ownRend.getContents?.()||[]){
       const doc=c.document as Document|undefined;
       if(doc&&!selectionDocs.has(doc)){
        selectionDocs.add(doc);
        for(const event of ['selectionchange','pointerup','touchend'])doc.addEventListener(event,announceSelection);
        observers.push(()=>{for(const event of ['selectionchange','pointerup','touchend'])doc.removeEventListener(event,announceSelection)});
       }
      if(c.document?.body)observers.push(observeTextColumnChanges(c.document.body,()=>requestAnimationFrame(()=>auditRef.current())));
     }
    });
    ownRend.on('relocated',(location:any)=>{
     if(cancelled||busy.current)return;
     commitRef.current(location);requestAnimationFrame(()=>auditRef.current());
    });
    const navigation=await ownBook.loaded.navigation;if(cancelled)return;
    const toc=flattenEpubToc(navigation?.toc||[]);setChapters(toc);
    const sections=ownBook.spine.spineItems.map((s:any)=>({index:s.index,href:s.href}));
    spineRef.current=sections;setSpine(sections);
    await ownRend.display(lastCfi.current||undefined);if(cancelled)return;
    await settleEpub(ownRend);commitRef.current(ownRend.currentLocation());setLoaded(true);
   }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Не удалось открыть EPUB');}
  }
  void mount();
  return()=>{cancelled=true;live.current=false;observers.forEach(stop=>stop());rendition.current=null;epub.current=null;try{ownRend?.destroy()}catch{}try{ownBook?.destroy()}catch{}};
 },[book.id,book.file]);
 useEffect(()=>{
  if(loaded&&rendition.current)applyEpubInk(rendition.current.themes,settings);
 },[loaded,settings.theme,settings.textContrast]);
 useEffect(()=>{
  const rend=rendition.current;if(!rend||!loaded||geometry.width<1||geometry.height<1)return;
  const restore=lastCfi.current;settledKey.current='';const measuringKey=layoutKey;
  enqueue(async()=>{
   applyEpubAppearance(rend.themes,settingsRef.current);
   rend.clear();rend.resize(geometry.width,geometry.height,restore);
   await rend.display(restore||undefined);
   await settleEpub(rend);
   for(const c of rend.getContents?.()||[])if(c.document?.body)invalidateTextColumnAudit(c.document.body);
   settledKey.current=measuringKey;
  });
 },[loaded,layoutKey,retry]);
 useEffect(()=>{if(rendition.current)applyEpubAppearance(rendition.current.themes,settings)},[settings.theme]);
 // An independent rendition measures real browser pages one section at a time.
 // No 1600-character locations are used for numbering or navigation.
 useEffect(()=>{
  if(!loaded||safeMode||!epub.current||!rendition.current||!probeHost.current||!geometry.width||!geometry.height)return;
  let active=true,probe:any;const key=layoutKey;
  async function measure(){
   try{
    const Rendition=rendition.current.constructor;
    probe=new Rendition(epub.current,{...EPUB_OPTIONS,width:geometry.width,height:geometry.height});
    probe.attachTo(probeHost.current);configureEpub(probe,settingsRef.current);
    for(const section of spine){
     if(!active)return;
     await probe.display(section.href);await settleEpub(probe);if(!active)return;
     const location=physicalPage(probe.currentLocation());
     setPageIndex(old=>{
      const values=old.key===key?old.values:{};
      return values[section.index]===location.total?old:{key,values:{...values,[section.index]:location.total}};
     });
    }
    // Some TOC entries start in the middle of a spine section. Resolve each
    // anchor against the same hidden rendition used for physical page counts.
    for(const [chapter,item] of chapters.entries()){
     if(!active)return;
     try{
      await probe.display(item.href);await settleEpub(probe);if(!active)return;
      const location=physicalPage(probe.currentLocation());
      if(!spine.some(s=>s.index===location.index))continue;
      setTocLocations(old=>{
       const values=old.key===key?old.values:{};
       const previous=values[chapter];
       return previous?.index===location.index&&previous.page===location.page?old:{key,values:{...values,[chapter]:{index:location.index,page:location.page}}};
      });
     }catch(e){console.warn('Не удалось определить страницу главы EPUB',item.href,e)}
    }
   }catch(e){if(active)console.error('Не удалось пересчитать страницы EPUB',e);}
  }
  void measure();return()=>{active=false;try{probe?.destroy()}catch{}};
 },[loaded,layoutKey,spine,safeMode,chapters]);
 useEffect(()=>{
  const r=rendition.current;if(!r||!loaded||(!safeMode&&r.settings.flow==='paginated'))return;
  enqueue(async()=>{
   applyEpubSafety(r,safeMode);r.flow(safeMode?'scrolled-doc':'paginated');r.clear();await r.display(lastCfi.current||undefined);
  });
 },[safeMode,loaded]);
 const values=pageIndex.key===layoutKey?pageIndex.values:{};
 const chapterPageNumbers=epubTocStartPages(spine,values,tocLocations.key===layoutKey?tocLocations.values:{},chapters.length);
 const indexed=spine.length>0&&spine.every(s=>values[s.index]>0);
 const totalPages=indexed?spine.reduce((n,s)=>n+values[s.index],0):0;
 const globalPage=indexed?spine.filter(s=>s.index<view.index).reduce((n,s)=>n+values[s.index],0)+view.page:0;
 const progress=indexed?(globalPage>=totalPages?100:Math.min(99,Math.round(globalPage/Math.max(1,totalPages)*100))):Math.round((book.position?.fraction||0)*100);
 // Reflow and pagination indexing are not user navigation.
 // Never timestamp or write progress from either operation.
 const go=(index:number,targetPage:number)=>enqueue(async()=>{
  const r=rendition.current,section=spineRef.current.find(s=>s.index===index);if(!r||!section)return;
  await r.display(section.href);await settleEpub(r);
  const here=physicalPage(r.currentLocation());
  const selected=targetPage===Infinity?here.total:Math.max(1,Math.min(here.total,targetPage));
  r.moveTo({left:(selected-1)*r.layout().delta,top:0});r.reportLocation();
 },true);
 const turn=(direction:number)=>enqueue(async()=>{
  const r=rendition.current,loc=physicalPage(r.currentLocation()),order=spineRef.current;
  const offset=order.findIndex(s=>s.index===loc.index);
  if(direction>0&&loc.page>=loc.total&&order[offset+1]){await r.display(order[offset+1].href);return;}
  if(direction<0&&loc.page<=1&&order[offset-1]){
   await r.display(order[offset-1].href);await settleEpub(r);
   const last=physicalPage(r.currentLocation());r.moveTo({left:(last.total-1)*r.layout().delta,top:0});r.reportLocation();return;
  }
  if(direction>0)await r.next();else await r.prev();
 },true);
 // Finish in-flight EPUB turns before unmounting, including fast exit taps.
 const leaveBook=()=>{
  if(!userNavigationPending.current){onBack();return;}
  void queue.current.finally(()=>{
   if(live.current&&rendition.current)
    commitRef.current(rendition.current.currentLocation(),true);
   onBack();
  });
 };
 const flushRef=useRef<()=>void>(()=>{});
 flushRef.current=()=>{
  if(userNavigationPending.current&&live.current&&rendition.current)
   commitRef.current(rendition.current.currentLocation(),true);
 };
 useEffect(()=>{
  const onHidden=()=>{if(document.visibilityState==='hidden')flushRef.current()};
  const onPageHide=()=>flushRef.current();
  document.addEventListener('visibilitychange',onHidden);
  window.addEventListener('pagehide',onPageHide);
  return ()=>{document.removeEventListener('visibilitychange',onHidden);
   window.removeEventListener('pagehide',onPageHide)};
 },[]);
 const retryPages=()=>{setIssue(null);setSafeMode(false);setRetry(v=>v+1)};
 const frameStyle={'--page-left':settings.margin+'px','--page-right':settings.marginRight+'px','--page-top':settings.verticalMargin+'px','--page-bottom':settings.bottomMargin+'px'} as React.CSSProperties;
 return <ReadingControls book={book} settings={settings} onSettings={s=>{if(safeMode)retryPages();onSettings(s)}} onBack={leaveBook}
  onNext={()=>turn(1)} onPrevious={()=>turn(-1)} safeMode={safeMode}
  chapters={chapters.length?chapters.map((entry,i)=>({...entry,page:chapterPageNumbers[i]})):undefined} currentChapter={currentChapter}
   quoteSelection={()=>captureEpubQuote(rendition.current?.getContents?.()||[],{chapter:view.index,page:view.page-1,fraction:progress/100,cfi:view.cfi,updatedAt:Date.now()})}
  onChapter={index=>{const item=chapters[index];if(item)enqueue(()=>rendition.current.display(item.href),true);}}
  position={{chapter:view.index,page:view.page-1,fraction:indexed?globalPage/Math.max(1,totalPages):(book.position?.fraction||0),cfi:view.cfi,updatedAt:Date.now()}}
  progress={progress} caption={safeMode?'Режим прокрутки':`Страница ${globalPage||view.page} из ${totalPages||view.total}`}
  pageNumber={indexed&&!safeMode?globalPage:undefined} totalPages={indexed&&!safeMode?totalPages:undefined}
  chapterTitle={chapters[currentChapter]?.title}
  onPage={indexed&&!safeMode?number=>{
   let offset=Math.max(0,Math.min(totalPages-1,Math.floor(number)-1));
   for(const section of spine){if(offset<values[section.index]){go(section.index,offset+1);return;}offset-=values[section.index];}
  }:undefined}>
  {issue&&<ClippingAlert issue={issue} onRetry={retryPages}/>}
  {error?<div className="reader-message">{error}</div>:<div className="epub-mount" ref={host} style={frameStyle}/>}
  <div className="epub-page-probe" ref={probeHost} aria-hidden="true" inert style={{width:geometry.width,height:geometry.height}}/>
 </ReadingControls>;
}
