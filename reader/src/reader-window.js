/** Reading pages must never extend beyond the viewport the browser can paint. */
export function trackReaderWindow(win,doc,onResize=()=>{}){
 let previousHeight,previousWidth;
 const update=()=>{
  const visualHeight=win.visualViewport?.height;
  const height=Math.min(win.innerHeight,visualHeight>0?visualHeight:win.innerHeight);
  if(height>0){
   const nextHeight=Math.floor(height);
   // Invalidate before changing the CSS geometry. A stage ResizeObserver
   // alone runs too late when the viewport itself shrinks during rotation.
   if(previousHeight!==undefined&&(previousHeight!==nextHeight||previousWidth!==win.innerWidth))onResize();
   previousHeight=nextHeight;previousWidth=win.innerWidth;
   // Physical screen dimensions include pixels the app may not own. Never use
   // them to recover apparent whitespace: it hides source lines off-screen.
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
