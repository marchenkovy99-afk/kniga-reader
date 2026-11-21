/** Media never inherits a reading theme. White is also the backing colour
 * for transparent line art; SVG fill/stroke attributes remain untouched. */
export function prepareBookMedia(doc:Document):()=>void{
 const size=()=>{
  const height=doc.defaultView?.innerHeight||doc.documentElement.clientHeight||600;
  doc.documentElement.style.setProperty('--libra-image-height',Math.max(48,height-64)+'px');
 };
 size();
 for(const media of Array.from(doc.querySelectorAll<HTMLElement|SVGElement>('img,svg'))){
  if(media.closest('svg')!==media&&media.closest('svg'))continue;
  for(const [key,value] of Object.entries({
   'background-color':'#fff','color-scheme':'light',filter:'none','mix-blend-mode':'normal',
   opacity:'1','max-width':'100%','max-height':'var(--libra-image-height)',
   width:'auto',height:'auto','object-fit':'contain','break-inside':'avoid'
  }))media.style.setProperty(key,value,'important');
  const parent=media.parentElement;
  if(parent&&parent!==doc.body&&!parent.textContent?.trim()&&parent.querySelectorAll('img,svg').length===1){
   parent.style.setProperty('line-height','0','important');
   parent.style.setProperty('text-indent','0','important');
   parent.style.setProperty('height','auto','important');
   parent.style.setProperty('break-inside','avoid','important');
  }
 }
 doc.defaultView?.addEventListener('resize',size);
 return ()=>doc.defaultView?.removeEventListener('resize',size);
}

function bounded(promise:Promise<unknown>,timeout=5000):Promise<void>{
 return new Promise(resolve=>{
  const timer=setTimeout(resolve,timeout);
  void promise.catch(()=>{}).finally(()=>{clearTimeout(timer);resolve()});
 });
}
/** Bad media or a remote font must not indefinitely block opening a book. */
export async function settleBookDocument(doc:Document,root:ParentNode=doc):Promise<void>{
 const images=Array.from(root.querySelectorAll('img'));
 await Promise.all([
  bounded(doc.fonts?.ready||Promise.resolve()),
  ...images.map(image=>bounded(image.decode?.()||Promise.resolve()))
 ]);
}

export function illustrationFromElement(element:Element|null):{src:string;alt:string}|null{
 const media=element?.closest('img,svg');if(!media)return null;
 if(media.localName==='img'){
  const img=media as HTMLImageElement;
  return img.currentSrc||img.src?{src:img.currentSrc||img.src,alt:img.alt}:null;
 }
 // Inline SVG artwork keeps original fills/strokes. Resolve linked rasters
 // against the chapter document before moving it into the parent viewer.
 const svg=media.cloneNode(true) as SVGElement;
 svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
 const originals=[media,...Array.from(media.querySelectorAll('*'))];
 const copies=[svg,...Array.from(svg.querySelectorAll('*'))];
 const presentation=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','color','opacity','font-family','font-size','font-weight','font-style','text-anchor','dominant-baseline','visibility'];
 for(const [index,original] of originals.entries()){
  const copy=copies[index] as SVGElement,computed=media.ownerDocument.defaultView?.getComputedStyle(original);
  // Chapter stylesheets are not available inside an <img> data URL. Freeze
  // their presentation without copying page geometry or theme colours.
  if(computed&&copy.style)for(const property of presentation){
   const value=computed.getPropertyValue(property);
   if(value)copy.style.setProperty(property,value.replace(/url\(["']?[^)"']*#([^)"']+)["']?\)/g,'url(#$1)'));
  }
 }
 for(const link of Array.from(svg.querySelectorAll('image'))){
  const ref=link.getAttribute('href')||link.getAttributeNS('http://www.w3.org/1999/xlink','href');
  if(ref){try{link.setAttribute('href',new URL(ref,media.ownerDocument.baseURI).href)}catch{}}
 }
 // Remove only reader sizing constraints, never original fill/stroke/fonts.
 for(const property of ['width','height','max-width','max-height','break-inside'])svg.style.removeProperty(property);
 return {src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg)),alt:media.getAttribute('aria-label')||'Иллюстрация'};
}

export function isIllustrationActivation(event:Event):boolean{
 return event.type==='click'||event.type==='keydown'&&['Enter',' '].includes((event as KeyboardEvent).key);
}
