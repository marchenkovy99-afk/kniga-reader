import {useEffect,useRef,useState} from 'react';
export type Illustration={src:string;alt:string};

export function IllustrationViewer({image,onClose}:{image:Illustration;onClose:()=>void}){
 const [zoom,setZoom]=useState(1),[failed,setFailed]=useState(false);
 const panel=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null),stage=useRef<HTMLDivElement>(null);
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const pinch=useRef<{distance:number;zoom:number}|null>(null);
 const zoomRef=useRef(zoom);zoomRef.current=zoom;
 const changeZoom=(value:number)=>setZoom(Math.max(1,Math.min(6,value)));
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;close.current?.focus();
  return ()=>{if(previous?.isConnected)previous.focus()};
 },[]);
 return <section ref={panel} className="illustration-viewer" role="dialog" aria-modal="true" aria-label="Иллюстрация" onKeyDown={event=>{
  if(event.key==='Escape'){event.stopPropagation();onClose();}
  if(event.key==='Tab'){
   const buttons=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]);
   const first=buttons[0],last=buttons[buttons.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
 }}>
  <header><strong>Иллюстрация</strong><button ref={close} type="button" aria-label="Закрыть иллюстрацию" onClick={onClose}>Готово</button></header>
  <div className="illustration-tools" role="group" aria-label="Масштаб иллюстрации">
   <button type="button" aria-label="Уменьшить иллюстрацию" disabled={zoom<=1} onClick={()=>changeZoom(zoom/2)}>−</button>
   <button type="button" onClick={()=>{changeZoom(1);stage.current?.scrollTo?.(0,0)}}>Вписать</button>
   <output aria-live="polite">{Math.round(zoom*100)}%</output>
   <button type="button" aria-label="Увеличить иллюстрацию" disabled={zoom>=6} onClick={()=>changeZoom(zoom*2)}>+</button>
  </div>
  <div ref={stage} className="illustration-stage" onPointerDown={event=>{
   if(event.pointerType==='mouse'&&event.button!==0)return;
   event.currentTarget.setPointerCapture?.(event.pointerId);
   pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
   if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:zoomRef.current}}
  }} onPointerMove={event=>{
   const previous=pointers.current.get(event.pointerId);if(!previous)return;
   pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
   if(pointers.current.size===2&&pinch.current){
    const [a,b]=[...pointers.current.values()];
    if(pinch.current.distance>0)changeZoom(pinch.current.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.current.distance);
   }else if(pointers.current.size===1){event.currentTarget.scrollLeft-=event.clientX-previous.x;event.currentTarget.scrollTop-=event.clientY-previous.y}
  }} onPointerUp={event=>{pointers.current.delete(event.pointerId);pinch.current=null}} onPointerCancel={event=>{pointers.current.delete(event.pointerId);pinch.current=null}}>
   {failed?<p role="alert">Не удалось открыть иллюстрацию.</p>:<img src={image.src} alt={image.alt||'Иллюстрация книги'} draggable={false} onError={()=>setFailed(true)} style={{width:zoom*100+'%',height:zoom*100+'%'}}/>}
  </div>
 </section>;
}
