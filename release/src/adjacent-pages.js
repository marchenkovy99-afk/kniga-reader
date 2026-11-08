// Isolated previews use the same BookBlock renderer / EPUB book, settings,
// safety hooks and physical-page layout as the live reader. No save callback
// or cloud operation is registered on these temporary renderers.
export async function prepareAdjacentPage(r,d,{win=window,signal,capture}){
 const doc=r.ownerDocument,view=r.querySelector('.reading-content .page-viewport')||r.querySelector('.reading-content .epub-mount');
 if(!view||signal?.aborted)return null;
 const liveBox=view.getBoundingClientRect();
 const flow=view.querySelector('.book-flow');
 const epub=view.libraEpubPreview,fb2=view.libraFb2Preview;
 const cancelled=()=>signal?.aborted||!r.isConnected;
 const host=doc.createElement('div');host.setAttribute('aria-hidden','true');host.setAttribute('inert','');
 host.dataset.libraPreviewProbe='';
 Object.assign(host.style,{position:'fixed',left:'-20000px',top:'0',width:liveBox.width+'px',height:liveBox.height+'px',overflow:'hidden',visibility:'hidden',pointerEvents:'none',background:'var(--bg)',color:'var(--fg)'});
 let renderer,destroyed=false;
 let timeout;
 const dispose=()=>{if(destroyed)return;destroyed=true;try{renderer?.destroy()}catch{}host.remove()};
 signal?.addEventListener('abort',dispose,{once:true});
 const within=promise=>Promise.race([promise,new Promise((_,reject)=>{timeout=win.setTimeout(()=>reject(Error('Page preview timed out')),6000)})]).finally(()=>win.clearTimeout(timeout));
 try{
  if(flow&&fb2){
   const state=fb2.state(),target=state.chapter+d;if(target<0||target>=state.total)return null;
   doc.body.append(host);const mount=doc.createElement('div');host.append(mount);renderer=fb2.render(mount,target);
   const {flow:measured,count,stride}=await within(renderer.ready);if(cancelled())return null;
   const copy=view.cloneNode(false);copy.className='page-viewport';copy.setAttribute('data-ready','true');
   Object.assign(copy.style,{width:liveBox.width+'px',height:liveBox.height+'px'});
   const frozen=measured.cloneNode(true);frozen.className='book-flow no-animation';
   frozen.style.visibility='visible';frozen.style.transform=`translateX(${-((d<0?count-1:0)*stride)}px)`;
   copy.append(frozen);host.append(copy);
   return capture(r,copy,liveBox)?.sheet||null;
  }
  if(!epub)return null;
  const state=epub.state(),native=state.rendition;if(!native||!state.book||state.geometry.width<1)return null;
  const location=epub.physical(native.currentLocation()),index=state.spine.findIndex(s=>s.index===location.index);
  const section=state.spine[index+d];if(!section)return null;
  doc.body.append(host);
  renderer=new native.constructor(state.book,{...epub.options,width:state.geometry.width,height:state.geometry.height});
  renderer.attachTo(host);epub.configure(renderer,state.settings);
  await within((async()=>{
   await renderer.display(section.href);await epub.settle(renderer);
   if(d<0){const loc=epub.physical(renderer.currentLocation());renderer.moveTo({left:Math.max(0,loc.total-1)*renderer.layout().delta,top:0});renderer.reportLocation();await epub.settle(renderer);}
  })());
  if(cancelled())return null;
  // Hidden probes must paint in a detached visual copy. Their original
  // offscreen placement and visibility do not enter the captured sheet.
  return capture(r,host,liveBox)?.sheet||null;
 }catch(error){if(!cancelled())console.debug('Libra adjacent page:',error?.message||error);return null;}
 finally{win.clearTimeout(timeout);signal?.removeEventListener('abort',dispose);dispose();}
}
