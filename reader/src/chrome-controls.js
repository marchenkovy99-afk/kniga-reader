/** Identify both reading directions without interpreting scrolling or text selection as navigation. */
export function readerTapAction(start,end,rect){
 if(!start||!end||start.pointerId!==end.pointerId||!rect.width||!rect.height)return null;
 const duration=end.time-start.time,dx=end.x-start.x,dy=end.y-start.y;
 if(duration<0||duration>900)return null;
 const y=(start.y-rect.top)/rect.height;
 if(y<0.06||y>0.94)return null;
 if(Math.abs(dx)>=44&&Math.abs(dx)>Math.abs(dy)*1.35)return dx>0?'previous':'next';
 if(duration>500||Math.hypot(dx,dy)>14)return null;
 const x=(start.x-rect.left)/rect.width;
 if(x<=0.28)return 'previous';
 if(x>=0.72)return 'next';
 if(y>=0.15&&y<=0.85)return 'toggle';
 return null;
}
/** An edge tap or swipe turns the page; only a central tap toggles the controls. */
export function attachReaderChrome(stage,turn){
 const reader=stage.closest('.reader');
 reader.classList.add('chrome-hidden');
 let down=null;
 const blocked=target=>target instanceof Element&&!!target.closest('a,button,[data-note],[data-annotation],input,textarea,select,[contenteditable="true"]');
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
  else if(action==='next')turn(1);
  else if(action==='previous')turn(-1);
 },{capture:true});
 stage.addEventListener('pointercancel',()=>{down=null;},{capture:true});
}
