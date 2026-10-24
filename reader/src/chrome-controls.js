/** Identify deliberate taps without treating a swipe, long press or page selection as a command. */
export function readerTapAction(start,end,rect){
 if(!start||!end||start.pointerId!==end.pointerId||end.time-start.time>500||end.time<start.time||Math.hypot(end.x-start.x,end.y-start.y)>14||!rect.width||!rect.height)return null;
 const x=(start.x-rect.left)/rect.width,y=(start.y-rect.top)/rect.height;
 if(y<0.12||y>0.88)return null;
 if(x>=0.28&&x<=0.72&&y>=0.2&&y<=0.8)return 'toggle';
 if(x<=0.22)return 'previous';
 if(x>=0.78)return 'next';
 return null;
}
/** Keep controls hidden during page turns. The stage itself survives repagination. */
export function attachReaderChrome(stage,turn){
 const reader=stage.closest('.reader');
 reader.classList.add('chrome-hidden');
 let down=null;
 const blocked=target=>target instanceof Element&&!!target.closest('a,button,[data-note],input,textarea,select,[contenteditable="true"]');
 stage.addEventListener('pointerdown',event=>{
  down=null;
  if(event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0)||blocked(event.target))return;
  down={pointerId:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now()};
 },{capture:true});
 stage.addEventListener('pointerup',event=>{
  if(!down)return;
  const start=down;down=null;
  if(blocked(event.target)||document.querySelector('dialog[open]')||window.getSelection()?.toString())return;
  const action=readerTapAction(start,{pointerId:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now()},stage.getBoundingClientRect());
  if(action==='toggle')reader.classList.toggle('chrome-hidden');
  else if(reader.classList.contains('chrome-hidden')&&action==='next')turn(1);
  else if(reader.classList.contains('chrome-hidden')&&action==='previous')turn(-1);
 },{capture:true});
 stage.addEventListener('pointercancel',()=>{down=null;},{capture:true});
}
