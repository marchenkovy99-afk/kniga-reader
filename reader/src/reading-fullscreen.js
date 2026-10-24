/** Unsupported iPhone APIs keep the safe, normal web-app viewport. */
export function createReadingFullscreen(doc){
 let owned=false;
 const active=()=>doc.fullscreenElement||doc.webkitFullscreenElement;
 async function enter(){
  const root=doc.documentElement,request=root?.requestFullscreen||root?.webkitRequestFullscreen;
  if(active()||!request||!(doc.fullscreenEnabled||doc.webkitFullscreenEnabled))return;
  try{await request.call(root);owned=active()===root;}catch{/* A denied request must not block opening a book. */}
 }
 async function leave(){
  if(!owned)return;owned=false;
  if(active()!==doc.documentElement)return;
  try{await (doc.exitFullscreen||doc.webkitExitFullscreen)?.call(doc);}catch{/* Keep normal reading available. */}
 }
 return {enter,leave};
}
