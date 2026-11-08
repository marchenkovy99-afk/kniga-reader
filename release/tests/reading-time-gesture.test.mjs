import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachReadingTime} from '../src/reading-time.js';
test('reading clock ignores visual gesture transforms while remaining active',async()=>{
 const {window:w}=new JSDOM('<!doctype html><div class="reading-root" data-book-id="book" data-reading-owner="guest"><div class="reading-content"><div class="page-viewport" data-ready="true"><div class="book-flow">Readable text</div></div></div><div data-libra-page-turn><div data-libra-turn-track></div></div></div>',{pretendToBeVisual:true,url:'https://fixture.test'});
 let now=0,reads=0,interval;Object.defineProperty(w.performance,'now',{value:()=>now});const computed=w.getComputedStyle.bind(w);w.getComputedStyle=(...a)=>{reads++;return computed(...a)};w.setInterval=fn=>(interval=fn,1);w.clearInterval=()=>{};
 const detach=attachReadingTime(w,w.document);reads=0;
 try{const track=w.document.querySelector('[data-libra-turn-track]');for(let i=0;i<60;i++){now+=16;track.style.transform=`translate3d(${-i}px,0,0)`;await Promise.resolve()}now=2000;interval();assert.equal(reads,0);assert.ok([...Array(w.localStorage.length)].some((_,i)=>w.localStorage.key(i).includes('reading-time')),'time is still persisted');}finally{detach();w.close()}
});
