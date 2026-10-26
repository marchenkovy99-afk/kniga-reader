/** iOS may retain a shorter CSS viewport after launching from the home screen. */
export function trackReaderWindow(win,doc){
 const update=()=>{
  const installed=win.navigator.standalone===true||win.matchMedia('(display-mode: standalone)').matches;
  const height=installed?win.innerHeight:(win.visualViewport?.height||win.innerHeight);
  if(height>0)doc.documentElement.style.setProperty('--reader-window-height',`${Math.round(height)}px`);
 };
 update();
 win.addEventListener('resize',update);
 win.addEventListener('pageshow',update);
 win.visualViewport?.addEventListener('resize',update);
 doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)update();});
 return update;
}
