import type {ReaderSettings} from '../domain';
import {applyEpubAppearance} from './epubAppearance';
export const epubTypographyKey=(s:ReaderSettings)=>JSON.stringify([s.fontSize,s.lineHeight,s.fontFamily,s.align,s.wordSpacing,s.letterSpacing,s.paragraphSpacing,s.paragraphIndent,s.fontWeight,s.hyphenation]);
/**
 * Publisher CSS may impose custom word gaps. Standardise narrative
 * justification and hyphenation without changing EPUB source text or CFIs.
 */
export function enforceEpubUniformSpacing(doc:Document):void{
 if(!doc.head||!doc.body)return;
 // EPUB chapters often declare lang=en (or omit it) despite containing
 // Russian text. Hyphenation dictionaries need the actual language.
 const sample=(doc.body.textContent||'').slice(0,12000);
 const russian=(sample.match(/[А-Яа-яЁё]/g)||[]).length;
 const latin=(sample.match(/[A-Za-z]/g)||[]).length;
 if(russian>=24&&russian>latin*1.5){
  doc.documentElement.lang='ru';
  doc.body.lang='ru';
 }

 let lock=doc.getElementById('libra-uniform-spaces') as HTMLStyleElement|null;
 if(!lock){
  lock=doc.createElement('style');
  lock.id='libra-uniform-spaces';
  doc.head.appendChild(lock);
 }
 lock.textContent=`
  html body, html body :is(p,div,section,article,blockquote,li,dd,dt) {
    text-align:var(--libra-text-align,justify)!important;
    text-align-last:left!important;
    text-justify:inter-character!important;
    hyphens:var(--libra-hyphens,auto)!important;
    -webkit-hyphens:var(--libra-hyphens,auto)!important;
    -webkit-hyphenate-limit-before:2;
    -webkit-hyphenate-limit-after:2;
    hyphenate-limit-chars:5 2 2;
    word-break:normal!important;
    overflow-wrap:break-word!important;
    word-spacing:var(--libra-word-spacing,0px)!important;
  }
  html body :is(h1,h2,h3,h4,h5,h6,pre,code,poem,verse) {
    text-align:left!important;
    text-align-last:left!important;
    hyphens:none!important;
    -webkit-hyphens:none!important;
  }
  html body :is(p,div,section,article,blockquote,li,dd,dt) :is(span,em,strong,b,i,a,small) {
    word-spacing:inherit!important;
  }
 `;
 // Inline !important beats even a strong injected stylesheet. Neutralize
 // only the authored justification and custom spacing on prose nodes.
 // Mutation does not remove or insert text, preserving EPUB CFI references.
 for(const element of Array.from(doc.body.querySelectorAll<HTMLElement>('[style]'))){
  if(element.closest('pre,code,math,svg'))continue;
  const style=element.style;
  if(element.matches('h1,h2,h3,h4,h5,h6,pre,code,poem,verse'))continue;
  if(style.textAlign)style.setProperty('text-align','var(--libra-text-align,justify)','important');
  if(style.wordSpacing)style.setProperty('word-spacing','var(--libra-word-spacing,0px)','important');
  if(style.textAlignLast)style.setProperty('text-align-last','left','important');
 }
}
export const EPUB_OPTIONS={flow:'paginated',spread:'none',gap:0,allowScriptedContent:false,snap:false};
export function configureEpub(rend:any,settings:ReaderSettings){
 // Register on both the visible rendition and hidden measuring rendition so
 // page counts always use the same line composition as the user sees.
 rend.hooks.content.register((content:any)=>enforceEpubUniformSpacing(content.document));
 rend.themes.default({
  'html,body,body *':{filter:'none!important','backdrop-filter':'none!important','-webkit-backdrop-filter':'none!important','mask-image':'none!important','-webkit-mask-image':'none!important','text-shadow':'none!important'},
  body:{margin:'0',padding:'0','overflow-wrap':'anywhere'},
  p:{'margin-top':'0','margin-bottom':'var(--libra-paragraph-gap,0px)','text-indent':'var(--libra-paragraph-indent,1em)'},
  'h1:first-child,h2:first-child,h3:first-child':{'margin-top':'0'},
  'body *':{'box-sizing':'border-box','max-width':'100%','overflow-wrap':'anywhere'},
  img:{'max-width':'100%','max-height':'calc(100vh - 1em)',width:'auto',height:'auto','object-fit':'contain'},
  svg:{'max-width':'100%','max-height':'calc(100vh - 1em)'},
  table:{width:'100%','table-layout':'fixed','overflow-wrap':'anywhere'},
  'td,th':{'overflow-wrap':'anywhere','word-break':'normal'},
  pre:{'white-space':'pre-wrap','overflow-wrap':'anywhere'}
 });
 applyEpubAppearance(rend.themes,settings);
}
export async function settleEpub(rend:any){
 const documents=(rend.getContents?.()||[]).map((c:any)=>c.document as Document);
 await Promise.all(documents.map(async(d:Document)=>{
  await d.fonts?.ready;
  await Promise.all(Array.from(d.images).map(image=>image.decode?.().catch(()=>{})));
 }));
 await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
}
export function physicalPage(location:any):{index:number;page:number;total:number;cfi:string}{
 const start=location?.start;
 return {index:Math.max(0,Number(start?.index)||0),page:Math.max(1,Number(start?.displayed?.page)||1),
  total:Math.max(1,Number(start?.displayed?.total)||1),cfi:typeof start?.cfi==='string'?start.cfi:''};
}

export function applyEpubSafety(rend:any,safe:boolean){
 for(const c of rend.getContents?.()||[])setEpubDocumentSafety(c.document,safe);
}
export function setEpubDocumentSafety(doc:Document,safe:boolean){
 let style=doc.getElementById('libra-safe-flow');
 if(!safe){style?.remove();return;}
 if(!style){style=doc.createElement('style');style.id='libra-safe-flow';doc.head.appendChild(style);}
 style.textContent='body *:not(img):not(svg):not(video) { height:auto!important; max-height:none!important; min-height:0!important; overflow:visible!important; clip:auto!important; clip-path:none!important; contain:none!important; position:static!important; max-width:100%!important; white-space:normal!important; overflow-wrap:anywhere!important; transform:none!important; margin-left:0!important; margin-right:0!important; margin-top:0!important; text-indent:0!important; } pre { white-space:pre-wrap!important; }';
}
