/** Snapshot only geometry the live reader actually owns. UI chrome is an overlay. */
export function readReadingViewport(stage){
 const rect=stage.getBoundingClientRect(),width=Math.floor(Math.min(stage.clientWidth,rect.width)),height=Math.floor(Math.min(stage.clientHeight,rect.height));
 return Object.freeze({width,height,left:rect.left,top:rect.top,right:rect.left+width,bottom:rect.top+height});
}
export function sameReadingViewport(stage,snapshot){
 const current=readReadingViewport(stage);return current.width===snapshot.width&&current.height===snapshot.height;
}
export function geometryRepair(snapshot,page,stage){
 if(!page)return null;const rect=page.getBoundingClientRect();
 let left=Math.max(snapshot.left,rect.left??snapshot.left),top=Math.max(snapshot.top,rect.top??snapshot.top);
 let right=left+Math.min(snapshot.width,page.clientWidth,rect.width),bottom=top+Math.min(snapshot.height,page.clientHeight,rect.height);
 const view=page.ownerDocument?.defaultView;
 for(let parent=page.parentElement;parent&&parent!==stage;parent=parent.parentElement){
  const style=view?.getComputedStyle?.(parent),bounds=parent.getBoundingClientRect();
  if(/^(hidden|clip|scroll|auto)$/.test(style?.overflowX||'')){left=Math.max(left,bounds.left+(parent.clientLeft||0));right=Math.min(right,bounds.left+(parent.clientLeft||0)+parent.clientWidth);}
  if(/^(hidden|clip|scroll|auto)$/.test(style?.overflowY||'')){top=Math.max(top,bounds.top+(parent.clientTop||0));bottom=Math.min(bottom,bounds.top+(parent.clientTop||0)+parent.clientHeight);}
 }
 const width=Math.floor(right-left),height=Math.floor(bottom-top);
 if(width<100||height<80||width===snapshot.width&&height===snapshot.height)return null;
 return {width,height};
}
