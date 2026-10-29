/** Snapshot only geometry the live reader actually owns. UI chrome is an overlay. */
export function readReadingViewport(stage){
 const rect=stage.getBoundingClientRect(),width=Math.floor(Math.min(stage.clientWidth,rect.width)),height=Math.floor(Math.min(stage.clientHeight,rect.height));
 return Object.freeze({width,height,left:rect.left,top:rect.top,right:rect.left+width,bottom:rect.top+height});
}
export function geometryRepair(snapshot,page){
 if(!page)return null;const rect=page.getBoundingClientRect();
 const width=Math.floor(Math.min(snapshot.width,page.clientWidth,rect.width)),height=Math.floor(Math.min(snapshot.height,page.clientHeight,rect.height));
 if(width<100||height<80||width===snapshot.width&&height===snapshot.height)return null;
 return {width,height};
}
