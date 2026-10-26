/** Reading pages must never extend beyond the viewport the browser can paint. */
export function trackReaderWindow(win,doc){
 const update=()=>{
  const visualHeight=win.visualViewport?.height;
  const height=Math.min(win.innerHeight,visualHeight>0?visualHeight:win.innerHeight);
  if(height>0){
   // Physical screen dimensions include pixels the app may not own. Never use
   // them to recover apparent whitespace: it hides source lines off-screen.
   doc.documentElement.style.setProperty('--reader-window-height',`${Math.floor(height)}px`);
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
