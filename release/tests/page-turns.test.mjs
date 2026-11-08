import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachPageTurns} from '../src/page-turns.js';

async function fixture({delay=0,reduced=false,epub=false,epubSettle=()=>Promise.resolve()}={}){
 const {window:w}=new JSDOM(`<!doctype html><html><head></head><body><div class="reading-root" data-book-id="fixture" data-page-animation="slide"><div class="reading-content"><div class="page-viewport" data-ready="true"><div class="book-flow" data-column-stride="414" style="transform:translateX(-828px)"><p>One two three</p></div></div></div><div class="reading-zones"></div><button class="reading-status"><span>3 / 8</span></button></div></body></html>`,{pretendToBeVisual:true});
 const d=w.document,r=d.querySelector('.reading-root'),view=r.querySelector('.page-viewport'),flow=view.firstElementChild;
 let now=0,id=0,frames=new Map(),timers=new Map(),page=2,reads=0,clones=0,navigations=0;
 Object.defineProperty(w.performance,'now',{value:()=>now});w.matchMedia=()=>({matches:reduced});
 const box={left:0,top:0,width:390,height:700,right:390,bottom:700};
 w.Element.prototype.getBoundingClientRect=function(){reads++;return this.tagName==='IFRAME'?{...box,width:8*390,left:-page*390,right:(8-page)*390}:this.classList.contains('book-flow')?{...box,left:-page*414,right:390-page*414}:box};
 Object.defineProperty(flow,'scrollWidth',{value:8*414-24});
 if(epub){
  view.className='epub-mount';flow.remove();const frame=d.createElement('iframe');view.append(frame);frame.contentDocument.body.innerHTML='<p>EPUB readable page</p>';
  const rendition={currentLocation:()=>({start:{cfi:'cfi-'+page,index:0,displayed:{page:page+1,total:8}}})};
  view.libraEpubPreview={state:()=>({rendition,spine:[{index:0}],key:'same'}),physical:loc=>({index:0,page:loc.start.displayed.page,total:8,cfi:loc.start.cfi}),settle:epubSettle};
 }else view.libraFb2Preview={state:()=>({chapter:0,page,pages:8,total:1,key:'same'})};
 const clone=w.Node.prototype.cloneNode;w.Node.prototype.cloneNode=function(...args){clones++;return clone.apply(this,args)};
 const computed=w.getComputedStyle.bind(w);w.getComputedStyle=(...a)=>{reads++;return computed(...a)};
 w.requestAnimationFrame=fn=>{frames.set(++id,fn);return id};w.cancelAnimationFrame=i=>frames.delete(i);
 w.setTimeout=(fn,ms=0)=>{timers.set(++id,{fn,at:now+ms});return id};w.clearTimeout=i=>timers.delete(i);
 w.requestIdleCallback=fn=>w.setTimeout(()=>fn({timeRemaining:()=>40}),1);w.cancelIdleCallback=w.clearTimeout;
 r.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;navigations++;const update=()=>{page+=e.key==='ArrowRight'?1:-1;flow.style.transform=`translateX(${-page*414}px)`;r.querySelector('.reading-status span').textContent=`${page+1} / 8`};delay?w.setTimeout(update,delay):update()});
 const detach=attachPageTurns(w,d);
 async function tick(ms=16){now+=ms;for(const [i,t] of [...timers])if(t.at<=now){timers.delete(i);t.fn()}const batch=[...frames];frames.clear();for(const [,fn] of batch)fn(now);await Promise.resolve();await Promise.resolve()}
 function touch(type,x,y=300){const e=new w.Event(type,{bubbles:true,cancelable:true});const p={clientX:x,clientY:y};Object.defineProperties(e,{touches:{value:type==='touchend'||type==='touchcancel'?[]:[p]},changedTouches:{value:[p]}});r.querySelector('.reading-zones').dispatchEvent(e);return e}
 await tick(60);await tick();await tick();
 const reset=()=>{reads=0;clones=0};
 const offset=()=>{const el=r.querySelector('[data-libra-turn-track]')||r.querySelector('[data-libra-turn-sheet=outgoing]');return Number(el?.style.transform.match(/translate3d\(([-.\d]+)/)?.[1]||0)};
 return {w,d,r,view,flow,tick,touch,offset,reset,stats:()=>({reads,clones,navigations,page}),close:()=>{detach();w.close()}};
}

test('a prepared touch and drag perform no geometry reads or cloning',async()=>{
 const f=await fixture();try{f.reset();f.touch('touchstart',300);f.touch('touchmove',240);await f.tick();assert.equal(f.offset(),-60);assert.equal(f.stats().reads,0);assert.equal(f.stats().clones,0)}finally{f.close()}
});
test('release continues immediately while the live page is still loading',async()=>{
 const f=await fixture({delay:500});try{f.touch('touchstart',300);f.touch('touchmove',150);await f.tick();const before=f.offset();f.touch('touchend',150);await f.tick();assert.ok(f.offset()<before,`${f.offset()} must continue past ${before}`);assert.equal(f.stats().navigations,0);await f.tick(300);assert.equal(f.stats().navigations,1);assert.ok(f.r.querySelector('[data-libra-page-turn]'),'hold preview until real page ready');await f.tick(510);await f.tick();assert.equal(f.r.querySelector('[data-libra-page-turn]')?.dataset.active,undefined)}finally{f.close()}
});
test('commit does not recapture or replace the prepared destination',async()=>{
 const f=await fixture();try{f.touch('touchstart',300);f.touch('touchmove',140);await f.tick();f.reset();f.touch('touchend',140);await f.tick();await f.tick();await f.tick();assert.equal(f.stats().clones,0)}finally{f.close()}
});
test('changing direction reuses the three mounted sheets',async()=>{
 const f=await fixture();try{f.touch('touchstart',250);f.touch('touchmove',200);await f.tick();const sheets=[...f.r.querySelectorAll('[data-libra-turn-sheet]')];f.touch('touchmove',300);await f.tick();assert.equal(f.offset(),50);assert.equal(sheets.length,3);assert.deepEqual([...f.r.querySelectorAll('[data-libra-turn-sheet]')],sheets);f.touch('touchcancel',300);assert.equal(f.stats().navigations,0)}finally{f.close()}
});
test('multiple moves are coalesced into a single transform per frame',async()=>{
 const f=await fixture();try{f.touch('touchstart',300);f.touch('touchmove',270);await f.tick();f.touch('touchmove',250);f.touch('touchmove',210);assert.equal(f.offset(),-30);await f.tick();assert.equal(f.offset(),-90)}finally{f.close()}
});
test('reverse flick cancels even after crossing the distance threshold',async()=>{
 const f=await fixture();try{f.touch('touchstart',300);await f.tick(50);f.touch('touchmove',110);await f.tick(90);f.touch('touchmove',160);await f.tick(16);f.touch('touchend',175);await f.tick(400);assert.equal(f.stats().navigations,0)}finally{f.close()}
});
test('edge tap commits once and does not animate the track',async()=>{
 const f=await fixture();try{f.touch('touchstart',380);f.touch('touchend',380);await f.tick();await f.tick();assert.equal(f.stats().navigations,1);assert.equal(f.stats().page,3);assert.equal(f.offset(),0)}finally{f.close()}
});
test('a short slow drag cancels without updating progress',async()=>{
 const f=await fixture();try{f.touch('touchstart',250);await f.tick(200);f.touch('touchmove',215);await f.tick(150);f.touch('touchend',215);await f.tick(400);assert.equal(f.stats().navigations,0);assert.equal(f.stats().page,2)}finally{f.close()}
});
test('reduced motion retains a single instant swipe navigation',async()=>{
 const f=await fixture({reduced:true});try{f.touch('touchstart',300);f.touch('touchmove',130);f.touch('touchend',130);await f.tick();assert.equal(f.stats().navigations,1)}finally{f.close()}
});
test('a committed settlement can be grabbed and reversed before navigation',async()=>{
 const f=await fixture();try{f.touch('touchstart',300);f.touch('touchmove',155);await f.tick();f.touch('touchend',155);await f.tick(32);const offset=f.offset();assert.equal(f.stats().navigations,0,'live navigation must wait until visual completion');f.touch('touchstart',220);f.touch('touchmove',240);await f.tick();assert.ok(Math.abs(f.offset()-(offset+20))<.01,'grab must preserve the current presentation offset');f.touch('touchcancel',240);assert.equal(f.stats().navigations,0)}finally{f.close()}
});
test('a seek invalidates cached visual content before the warming timer fires',async()=>{
 const f=await fixture();try{f.flow.style.transform='translateX(-2070px)';f.r.querySelector('.reading-status span').textContent='6 / 8';await Promise.resolve();f.touch('touchstart',300);f.touch('touchmove',150);await f.tick(1);const visual=f.r.querySelector('[data-libra-page-turn][data-active] .book-flow');assert.ok(!visual||visual.style.transform==='translateX(-2070px)','must never activate the previous reading position');}finally{f.close()}
});
test('a swipe during the live-page handoff is queued instead of dropped',async()=>{
 const f=await fixture({delay:500});try{f.touch('touchstart',300);f.touch('touchmove',140);await f.tick();f.touch('touchend',140);await f.tick(300);f.touch('touchstart',300);f.touch('touchmove',130);f.touch('touchend',130);await f.tick(510);for(let i=0;i<20;i++)await f.tick(50);assert.equal(f.stats().navigations,2);assert.equal(f.stats().page,4)}finally{f.close()}
});

test('EPUB handoff waits for the queued live save before removing its final visual page',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const f=await fixture({epub:true,epubSettle:()=>pending});try{f.touch('touchstart',300);f.touch('touchmove',140);await f.tick();f.touch('touchend',140);await f.tick(300);assert.equal(f.stats().navigations,1);assert.ok(f.r.querySelector('[data-libra-page-turn][data-active]'));resolve();await Promise.resolve();await f.tick();await f.tick();assert.equal(f.r.querySelector('[data-libra-page-turn][data-active]'),null)}finally{f.close()}
});
