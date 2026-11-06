import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReadingClock,formatReadingTime} from './reading-time.js';
test('counts visible text without page turns, pauses, resumes and persists increments',()=>{
 let now=0,total=0;const clock=createReadingClock({now:()=>now,onTime:ms=>total+=ms});
 clock.setActive(true);now=2500;clock.setActive(false);assert.equal(total,2500);
 now=60000;clock.setActive(true);now=61500;clock.flush();assert.equal(total,4000);
 clock.flush();assert.equal(total,4000);
});
test('does not count a suspended timer or a previous book after switching',()=>{
 let now=0,total=0;const clock=createReadingClock({now:()=>now,onTime:ms=>total+=ms});
 clock.setActive(true);now=120000;clock.flush();assert.equal(total,0);
 now+=1000;clock.setActive(false);assert.equal(total,1000);
 now+=3000;clock.flush();assert.equal(total,1000);
});
test('formats seconds, minutes and hours without losing small sessions',()=>{
 assert.equal(formatReadingTime(12500),'12 сек');assert.equal(formatReadingTime(120000),'2 мин');assert.equal(formatReadingTime(3720000),'1 ч 2 мин');
});
import {JSDOM} from 'jsdom';
import {attachReadingTime} from './reading-time.js';
function setup(){
 const dom=new JSDOM('<div class="reading-root" data-book-id="a" data-reading-owner="user-1"><div class="page-viewport" data-ready="true"><div class="book-flow">Текст книги</div></div><div class="reading-bottom"></div></div>',{url:'https://libra.test',pretendToBeVisual:true});
 const {window:win}=dom;let now=0,tick;Object.defineProperty(win.performance,'now',{value:()=>now});win.setInterval=fn=>{tick=fn;return 1};win.clearInterval=()=>{};
 const stop=attachReadingTime(win,win.document),key='libra-reading-time:v1:user-1:a';
 return {win,key,stop,advance(ms){now+=ms;tick();},saved(){return JSON.parse(win.localStorage.getItem(key)||'null');}};
}
test('reader integration saves time, excludes dialogs and hidden screens, and survives reopening',()=>{
 const s=setup();try{
  s.advance(1200);assert.equal(s.saved().total,1200);assert.match(s.win.document.querySelector('[data-libra-reading-time]').textContent,/1 сек/);
  const modal=s.win.document.createElement('div');modal.className='sheet-scrim';s.win.document.querySelector('.reading-root').append(modal);
  s.advance(0);s.advance(4000);assert.equal(s.saved().total,1200);modal.remove();s.advance(0);s.advance(1000);assert.equal(s.saved().total,2200);
  Object.defineProperty(s.win.document,'visibilityState',{value:'hidden',configurable:true});s.win.document.dispatchEvent(new s.win.Event('visibilitychange'));s.advance(3000);assert.equal(s.saved().total,2200);
  Object.defineProperty(s.win.document,'visibilityState',{value:'visible',configurable:true});s.win.document.dispatchEvent(new s.win.Event('visibilitychange'));s.advance(500);assert.equal(s.saved().total,2700);
  s.stop();const stop=attachReadingTime(s.win,s.win.document);s.advance(1000);assert.equal(s.saved().total,3700);stop();
 }finally{s.stop();s.win.close();}
});
test('switching books or accounts keeps separate totals and library time is excluded',()=>{
 const s=setup();try{
  s.advance(1000);const root=s.win.document.querySelector('.reading-root');root.dataset.bookId='b';s.advance(0);s.advance(2000);
  assert.equal(s.saved().total,1000);assert.equal(JSON.parse(s.win.localStorage.getItem('libra-reading-time:v1:user-1:b')).total,2000);
  root.dataset.readingOwner='user-2';s.advance(0);s.advance(1000);assert.equal(JSON.parse(s.win.localStorage.getItem('libra-reading-time:v1:user-2:b')).total,1000);
  root.remove();s.advance(0);s.advance(3000);assert.equal(s.saved().total,1000);
 }finally{s.stop();s.win.close();}
});
