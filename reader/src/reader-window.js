/** iOS may retain a shorter CSS viewport after launching from the home screen. */
export function trackReaderWindow(win,doc){
 const update=()=>{
  const installed=win.navigator.standalone===true||win.matchMedia('(display-mode: standalone)').matches;
  let height=installed?win.innerHeight:(win.visualViewport?.height||win.innerHeight);
  // Home-screen iPhones can retain Safari's shorter innerHeight as well as dvh.
  // A full-width, unzoomed phone window has the screen's oriented dimensions.
  // Only recover a toolbar-sized shortfall; leave keyboard/split windows alone.
  if(installed&&/iPhone|iPod/.test(win.navigator.userAgent||'')&&(win.visualViewport?.scale||1)===1){
   const sides=[win.screen?.width||0,win.screen?.height||0].sort((a,b)=>a-b);
   const landscape=win.innerWidth>win.innerHeight;
   const screenWidth=sides[landscape?1:0],screenHeight=sides[landscape?0:1];
   if(Math.abs(screenWidth-win.innerWidth)<=1&&screenHeight>=height&&screenHeight-height<=120)height=screenHeight;
  }
  if(height>0)doc.documentElement.style.setProperty('--reader-window-height',`${Math.round(height)}px`);
 };
 update();
 win.addEventListener('resize',update);
 win.addEventListener('pageshow',update);
 win.visualViewport?.addEventListener('resize',update);
 doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)update();});
 return update;
}
