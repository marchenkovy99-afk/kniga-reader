import type {ReaderSettings} from '../domain';
import {applyEpubAppearance} from './epubAppearance';
export const epubTypographyKey=(s:ReaderSettings)=>JSON.stringify([s.fontSize,s.lineHeight,s.fontFamily,s.align,s.wordSpacing,s.letterSpacing,s.paragraphSpacing,s.paragraphIndent,s.fontWeight,s.hyphenation]);
export const EPUB_OPTIONS={flow:'paginated',spread:'none',gap:0,allowScriptedContent:false,snap:false};
export function configureEpub(rend:any,settings:ReaderSettings){
 rend.themes.default({
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
 style.textContent='body *:not(img):not(svg):not(video) { height:auto!important; max-height:none!important; min-height:0!important; overflow:visible!important; clip:auto!important; clip-path:none!important; contain:none!important; position:static!important; } pre { white-space:pre-wrap!important; }';
}
