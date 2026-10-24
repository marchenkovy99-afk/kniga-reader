import test from 'node:test';
import assert from 'node:assert/strict';
import {readerTapAction} from '../reader/src/chrome-controls.js';
const area={left:0,top:0,width:390,height:780};
const at=(x,y,t=0,id=1)=>({x,y,time:t,pointerId:id});
test('central deliberate tap toggles chrome',()=>assert.equal(readerTapAction(at(195,390),at(195,390,160),area),'toggle'));
test('edge taps are page navigation',()=>{
 assert.equal(readerTapAction(at(30,390),at(31,390,110),area),'previous');
 assert.equal(readerTapAction(at(360,390),at(360,390,110),area),'next');
});
test('swiping and long presses never toggle chrome',()=>{
 assert.equal(readerTapAction(at(195,390),at(225,390,170),area),null);
 assert.equal(readerTapAction(at(195,390),at(195,390,650),area),null);
});
test('top/bottom and mismatched pointers do not change chrome',()=>{
 assert.equal(readerTapAction(at(195,60),at(195,60,100),area),null);
 assert.equal(readerTapAction(at(195,390),at(195,390,100,2),area),null);
});
