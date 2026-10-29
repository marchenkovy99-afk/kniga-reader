/** Resolve the actual CSS reading viewport in a Home Screen PWA.
 * iOS may report a transient shorter visualViewport despite an unchanged
 * layout viewport, even when no keyboard or zoom is present. Trust the
 * layout/inner viewport only for installed, unfocused, unzoomed reading.
 * Never infer extra pixels from physical screen.height.
 */
export function readerPaintHeight(win,doc){
 const inner=Number(win.innerHeight)||0,client=Number(doc.documentElement?.clientHeight)||0;
 const layout=client>0?client:inner;
 const visual=Number(win.visualViewport?.height)||Math.min(inner,layout);
 const installed=win.navigator?.standalone===true||win.matchMedia?.('(display-mode: standalone)')?.matches===true;
 const focused=doc.activeElement;
 const editable=Boolean(focused?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(focused?.tagName));
 const zoomed=(Number(win.visualViewport?.scale)||1)>1.05;
 const keyboardLikely=layout-visual>Math.max(140,layout*.23);
 // CSS viewport can be taller than both iOS JS-reported heights in a Home
 // Screen app. Its clientHeight is paintable; physical screen.height is not.
 // In browser tabs, zoom and keyboard modes use the most conservative bound.
 return Math.max(0,installed&&!editable&&!zoomed&&!keyboardLikely?layout:Math.min(inner,layout,visual));
}
/** Resize before painting, so a stale page is never displayed clipped. */
export function trackReaderWindow(win,doc,onResize=()=>{}){
 let previousHeight,previousWidth;
 const update=()=>{
  const height=readerPaintHeight(win,doc);
  if(height>0){
   const nextHeight=Math.floor(height);
   // Invalidate before changing the CSS geometry. A stage ResizeObserver
   // alone runs too late when the viewport itself shrinks during rotation.
   if(previousHeight!==undefined&&(previousHeight!==nextHeight||previousWidth!==win.innerWidth))onResize();
   previousHeight=nextHeight;previousWidth=win.innerWidth;
   // Paintable CSS viewport, not physical screen.height, owns pagination.
   doc.documentElement.style.setProperty('--reader-window-height',`${nextHeight}px`);
   doc.documentElement.style.setProperty('--reader-controls-inset','0px');
  }
 };
 update();
 win.addEventListener('resize',update);
 win.addEventListener('pageshow',update);
 win.visualViewport?.addEventListener('resize',update);
 doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)update();});
 return update;
}

/** CSS updates media queries before resize handlers can rebuild a page. */
export function viewportPaintQuery(win){
 const size=axis=>{
  const reported=Math.floor(axis==='width'?win.innerWidth:win.innerHeight);
  if(win.matchMedia(`(${axis}:${reported}px)`).matches)return reported;
  // Safari's layout viewport and JS viewport can differ. Ask the same media
  // engine that will enforce the guard, rather than assuming they agree.
  let low=0,high=Math.max(32768,reported*2);
  while(high-low>1){const mid=Math.floor((low+high)/2);if(win.matchMedia(`(min-${axis}:${mid}px)`).matches)low=mid;else high=mid;}
  return low;
 };
 return `(min-width:${size('width')}px) and (min-height:${size('height')}px)`;
}
