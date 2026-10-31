import type {FB2Anchor} from './anchors';
import type {SavedQuote,ThemeName} from './domain';

/** Native CSS Highlights paint ink without altering the book DOM or its pagination. */
export const QUOTE_HIGHLIGHT='libra-saved-quote';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
const HIGHLIGHT_STYLE_ID='libra-saved-quote-style';

function installRanges(doc:Document,ranges:Range[]):void{
 const view=doc.defaultView as (Window & {Highlight?:new(...ranges:Range[])=>unknown,CSS?:{highlights?:Map<string,unknown>}})|null;
 const registry=view?.CSS?.highlights;
 if(!registry||!view?.Highlight)return; // Never rewrite the source DOM as a fallback.
 if(ranges.length)registry.set(QUOTE_HIGHLIGHT,new view.Highlight(...ranges));
 else registry.delete(QUOTE_HIGHLIGHT);
}
export function clearQuoteHighlights(doc:Document):void{
 const view=doc.defaultView as (Window & {CSS?:{highlights?:Map<string,unknown>}})|null;
 view?.CSS?.highlights?.delete(QUOTE_HIGHLIGHT);
}

/** HTML text can repaginate; its block indices and text offsets do not. */
function fb2Point(flow:HTMLElement,anchor:FB2Anchor):{node:Text,offset:number}|null{
 const block=Array.from(flow.querySelectorAll<HTMLElement>('[data-block-index]'))
  .find(element=>Number(element.dataset.blockIndex)===anchor.block);
 if(!block)return null;
 const walker=flow.ownerDocument.createTreeWalker(block,NodeFilter.SHOW_TEXT);
 let node:Node|null,count=0;
 while((node=walker.nextNode())){
  if(count++===anchor.textNode){
   const text=node as Text;
   return {node:text,offset:Math.min(text.length,Math.max(0,anchor.offset))};
  }
 }
 return null;
}
function restoreFB2Range(flow:HTMLElement,quote:SavedQuote):Range|null{
 if(!quote.position.anchor)return null;
 const start=fb2Point(flow,quote.position.anchor);
 if(!start)return null;
 const doc=flow.ownerDocument,range=doc.createRange();
 range.setStart(start.node,start.offset);
 if(quote.endAnchor){
  const end=fb2Point(flow,quote.endAnchor);
  if(!end)return null;
  try{range.setEnd(end.node,end.offset)}catch{return null}
  return !range.collapsed&&normalize(range.toString())===normalize(quote.text)?range:null;
 }
 // Compatibility for saved quotes made before end anchors were persisted.
 // Seek a matching end without guessing when the text no longer matches.
 const walker=doc.createTreeWalker(flow,NodeFilter.SHOW_TEXT);
 let node:Node|null,started=false,steps=0;
 while((node=walker.nextNode())){
  if(!started){if(node!==start.node)continue;started=true}
  const text=node as Text,minimum=node===start.node?start.offset:0;
  for(let offset=minimum+1;offset<=text.length;offset++){
   range.setEnd(text,offset);
   const candidate=normalize(range.toString()),expected=normalize(quote.text);
   if(candidate===expected)return range;
   if(candidate.length>expected.length+5)break;
  }
  if(++steps>100||normalize(range.toString()).length>quote.text.length+100)break;
 }
 return null;
}

export function applyFB2QuoteHighlights(flow:HTMLElement|null,quotes:readonly SavedQuote[],chapter:number):void{
 if(!flow){clearQuoteHighlights(document);return}
 const ranges=quotes.filter(q=>q.position.chapter===chapter).map(q=>restoreFB2Range(flow,q)).filter((r):r is Range=>Boolean(r));
 installRanges(flow.ownerDocument,ranges);
}

/** EPUB's range CFIs identify the selected characters even after font changes. */
export function applyEpubQuoteHighlights(contents:readonly any[],quotes:readonly SavedQuote[],theme:ThemeName):void{
 for(const content of contents){
  const doc=content?.document as Document|undefined;
  if(!doc?.body)continue;
  const style=doc.getElementById(HIGHLIGHT_STYLE_ID)||doc.createElement('style');
  if(!style.parentNode){style.id=HIGHLIGHT_STYLE_ID;(doc.head||doc.documentElement).appendChild(style)}
  const dark=theme==='night'||theme==='oled';
  style.textContent=`::highlight(${QUOTE_HIGHLIGHT}) {background-color: ${dark?'rgba(197,151,74,.42)':'rgba(239,185,65,.52)'} !important;}`;
  const ranges:Range[]=[];
  for(const quote of quotes){
   const cfi=quote.position.cfi;
   if(!cfi)continue;
   try{
    const range=content.range?.(cfi) as Range|null;
    if(range&&!range.collapsed&&doc.body.contains(range.commonAncestorContainer)&&
      normalize(range.toString())===normalize(quote.text))ranges.push(range);
   }catch{/* Another spine section or a legacy/non-range CFI. */}
  }
  installRanges(doc,ranges);
 }
}
