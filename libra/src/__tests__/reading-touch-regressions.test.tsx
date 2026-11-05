// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {ReadingControls} from '../components/ReadingControls';
import {DEFAULT_SETTINGS,type StoredBook} from '../domain';

async function mount(quoteSelection?:()=>any){
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);
 const root=createRoot(host),next=vi.fn(),previous=vi.fn();
 await act(async()=>root.render(<ReadingControls book={{id:'gestures',title:'Book',bookmarks:[]} as unknown as StoredBook}
 settings={DEFAULT_SETTINGS} onSettings={()=>{}} onBack={()=>{}} onNext={next} onPrevious={previous}
 position={{chapter:0,page:0,fraction:0,updatedAt:1}} progress={0} caption="1"
 quoteSelection={quoteSelection}><p>Selectable book text</p></ReadingControls>));
 const zones=host.querySelector('.reading-zones') as HTMLElement;
 zones.getBoundingClientRect=()=>({left:0,top:0,width:400,height:800,right:400,bottom:800,x:0,y:0,toJSON(){}}) as DOMRect;
 const send=async(type:string,x:number,y=200)=>{
  const event=new Event(type,{bubbles:true,cancelable:true});
  Object.defineProperties(event,{touches:{value:type==='touchend'?[]:[{clientX:x,clientY:y}]},
   changedTouches:{value:[{clientX:x,clientY:y}]}});
  await act(async()=>zones.dispatchEvent(event));
 };
 return {host,zones,next,previous,send,close:async()=>{await act(async()=>root.unmount());host.remove()}};
}
it('opens controls on the first touchend without waiting for a synthetic click',async()=>{
 const m=await mount();
 try{
  await m.send('touchstart',200);await m.send('touchend',200);
  expect(m.host.querySelector('.reading-top')?.classList.contains('visible')).toBe(true);
  await act(async()=>m.zones.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:200,clientY:200})));
  expect(m.host.querySelector('.reading-top')?.classList.contains('visible')).toBe(true);
  expect(m.next).not.toHaveBeenCalled();expect(m.previous).not.toHaveBeenCalled();
 }finally{await m.close()}
});
it('shows quote actions for a valid selection without requiring the quote button first',async()=>{
 let selected:any=null;
 const m=await mount(()=>selected);
 try{
  selected={text:'Selectable book text',position:{chapter:0,page:0,fraction:0,updatedAt:1},rect:{left:10,right:150,top:200,bottom:230}};
  await act(async()=>window.dispatchEvent(new Event('libra-quote-selection')));
  expect(m.host.querySelector('[aria-label="Действия с выделенной цитатой"]')).not.toBeNull();
 }finally{await m.close()}
});
it('does not treat a vertical drag or cancelled gesture as a tap',async()=>{
 const m=await mount();
 try{
  await m.send('touchstart',200,200);await m.send('touchend',200,350);
  expect(m.host.querySelector('.reading-top')?.classList.contains('visible')).toBe(false);
  await m.send('touchstart',200);await m.send('touchcancel',200);await m.send('touchend',200);
  expect(m.host.querySelector('.reading-top')?.classList.contains('visible')).toBe(false);
  expect(m.next).not.toHaveBeenCalled();expect(m.previous).not.toHaveBeenCalled();
 }finally{await m.close()}
});
