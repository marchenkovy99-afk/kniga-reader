/** Actual glyph rectangles are audited, including columns outside the page window. */
export type ClipIssue={kind:'horizontal'|'vertical'|'translation';message:string;blockIndex?:number};
export type ColumnGeometry={width:number;height:number;stride:number;originLeft?:number;originTop?:number};
export const CLIP_TOLERANCE=3;
type Fragment={left:number;right:number;top:number;bottom:number;blockIndex?:number};
type AuditCache={key:string;fragments:Fragment[];issue:ClipIssue|null;dirty:boolean;observer:MutationObserver};
const caches=new WeakMap<HTMLElement,AuditCache>();
const transformStyle=(value:string|null)=>/(?:^|;)\s*transform\s*:\s*([^;]*)/i.exec(value||'')?.[1]?.trim()||'';
const pureTranslation=(value:string)=>!value||value==='none'||/^translate(?:X|Y|3d)?\([^)]*\)$/i.test(value);
const layoutStyle=(value:string|null)=>(value||'').replace(/(?:^|;)\s*(?:transform|transition)(?:-[\w-]+)?\s*:[^;]*/gi,'').replace(/\s/g,'').replace(/^;+|;+$/g,'');
function affectsLayout(record:MutationRecord,root:HTMLElement){
 if(record.type==='attributes'&&record.target===root&&record.attributeName==='style'){
  const current=root.getAttribute('style');
  const before=transformStyle(record.oldValue),after=transformStyle(current);
  if(before!==after&&(!pureTranslation(before)||!pureTranslation(after)))return true;
  return layoutStyle(record.oldValue)!==layoutStyle(current);
 }
 return true;
}
export function invalidateTextColumnAudit(root:HTMLElement){const cache=caches.get(root);if(cache)cache.dirty=true;}
/** Observe real content/style changes without re-auditing an unchanged chapter on every page translation. */
export function observeTextColumnChanges(root:HTMLElement,onChange:()=>void):()=>void{
 const observer=new MutationObserver(records=>{
  if(records.some(record=>affectsLayout(record,root))){invalidateTextColumnAudit(root);onChange();}
 });
 observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true});
 return ()=>observer.disconnect();
}
export function inspectTextColumns(root:HTMLElement,geometry:ColumnGeometry):ClipIssue|null{
 const {width,height,stride}=geometry;
 if(width<=0||height<=0||stride<=0)return null;
 const rootRect=root.getBoundingClientRect();
 const originLeft=geometry.originLeft??rootRect.left,originTop=geometry.originTop??rootRect.top;
 const key=[width,height,stride,originLeft-rootRect.left,originTop-rootRect.top].join(':');
 let cache=caches.get(root);
 if(!cache){
  const observer=new MutationObserver(records=>{if(records.some(record=>affectsLayout(record,root)))invalidateTextColumnAudit(root);});
  observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true});
  cache={key:'',fragments:[],issue:null,dirty:true,observer};caches.set(root,cache);
 }
 if(cache.observer.takeRecords().some(record=>affectsLayout(record,root)))cache.dirty=true;
 if(cache.dirty||cache.key!==key){
  const fragments:Fragment[]=[];
  let localIssue:ClipIssue|null=null;
  const document=root.ownerDocument;
  const walker=document.createTreeWalker(root,4);
  const range=document.createRange();
  const visibility=new WeakMap<Element,boolean>();
  const clippingAncestors=new WeakMap<Element,{x:boolean;y:boolean;rects:DOMRect[]}[]>();
  const clipBoxes=(element:Element):{x:boolean;y:boolean;rects:DOMRect[]}[]=>{
   const known=clippingAncestors.get(element);if(known)return known;
   if(element===root)return [];
   const parent=element.parentElement?clipBoxes(element.parentElement):[];
   const style=document.defaultView!.getComputedStyle(element);
   const x=/^(hidden|clip|auto|scroll)$/.test(style.overflowX||style.overflow);
   const y=/^(hidden|clip|auto|scroll)$/.test(style.overflowY||style.overflow);
   const boxes=x||y?[...parent,{x,y,rects:Array.from(element.getClientRects())}]:parent;
   clippingAncestors.set(element,boxes);return boxes;
  };
  const visible=(element:Element):boolean=>{
   const known=visibility.get(element);if(known!==undefined)return known;
   const style=document.defaultView!.getComputedStyle(element);
   const result=style.display!=='none'&&style.visibility!=='hidden'&&style.visibility!=='collapse'&&
    !element.hasAttribute('hidden')&&(element===root||!element.parentElement||visible(element.parentElement));
   visibility.set(element,result);return result;
  };
  for(let node=walker.nextNode();node;node=walker.nextNode()){
   if(!node.textContent?.trim()||!node.parentElement||!visible(node.parentElement))continue;
   range.selectNodeContents(node);
   const block=node.parentElement.closest<HTMLElement>('[data-block-index]');
   const blockIndex=block?Number(block.dataset.blockIndex):undefined;
   for(const rect of Array.from(range.getClientRects())){
    if(rect.width<.1||rect.height<.1)continue;
    // A paragraph can clip its own glyphs even while its outer position fits
    // the page. Root clipping is intentional: its offscreen columns are valid.
    for(const box of clipBoxes(node.parentElement)){
     if(!box.rects.length)continue;
     const fits=box.rects.some(bound=>(!box.x||(rect.left>=bound.left-CLIP_TOLERANCE&&rect.right<=bound.right+CLIP_TOLERANCE))&&
      (!box.y||(rect.top>=bound.top-CLIP_TOLERANCE&&rect.bottom<=bound.bottom+CLIP_TOLERANCE)));
     if(!fits&&!localIssue)localIssue={kind:box.y?'vertical':'horizontal',message:'Внутренний блок обрезает текст.',blockIndex};
    }
    fragments.push({left:rect.left-originLeft,right:rect.right-originLeft,top:rect.top-originTop,bottom:rect.bottom-originTop,blockIndex});
   }
  }
  range.detach();cache.fragments=fragments;cache.issue=localIssue;cache.key=key;cache.dirty=false;
 }
 if(cache.issue)return cache.issue;
 for(const rect of cache.fragments){
  const base=Math.max(0,Math.floor(rect.left/stride));
  const gap=Math.max(0,stride-width);
  const column=base+(rect.left-base*stride>width+gap*.35?1:0);
  const left=rect.left-column*stride,right=rect.right-column*stride;
  if(left < -CLIP_TOLERANCE||right>width+CLIP_TOLERANCE){
   return {kind:'horizontal',message:'Текст выходит за боковую границу страницы.',blockIndex:rect.blockIndex};
  }
  if(rect.top < -CLIP_TOLERANCE||rect.bottom>height+CLIP_TOLERANCE){
   return {kind:'vertical',message:'Текст выходит за верхнюю или нижнюю границу страницы.',blockIndex:rect.blockIndex};
  }
 }
 return null;
}
/** Translation is checked separately: a valid source layout can still be shown at the wrong column origin. */
export function inspectCurrentColumn(root:HTMLElement,viewport:HTMLElement,page:number,stride:number):ClipIssue|null{
 const content=root.getBoundingClientRect(),view=viewport.getBoundingClientRect();
 if(Math.abs(content.left+page*stride-view.left)>CLIP_TOLERANCE||Math.abs(content.top-view.top)>CLIP_TOLERANCE){
  return {kind:'translation',message:'Положение текста не совпадает с границами страницы.'};
 }
 return null;
}
