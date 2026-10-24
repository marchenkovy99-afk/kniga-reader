import test from 'node:test';
import assert from 'node:assert/strict';
import {readerTapAction} from '../reader/src/chrome-controls.js';
const area={left:0,top:0,width:390,height:780};
const at=(x,y,t=0,id=1)=>({x,y,time:t,pointerId:id});
test('central tap toggles controls',()=>assert.equal(readerTapAction(at(195,390),at(196,391,160),area),'toggle'));
test('taps on left and right turn in correct direction',()=>{
 assert.equal(readerTapAction(at(55,390),at(55,390,120),area),'previous');
 assert.equal(readerTapAction(at(340,390),at(340,390,120),area),'next');
});
test('swipe right goes back; swipe left goes forward',()=>{
 assert.equal(readerTapAction(at(160,390),at(260,395,230),area),'previous');
 assert.equal(readerTapAction(at(260,390),at(160,395,230),area),'next');
});
test('vertical drag, long press, tiny swipe and wrong pointer have no effect',()=>{
 assert.equal(readerTapAction(at(195,300),at(200,460,200),area),null);
 assert.equal(readerTapAction(at(195,390),at(195,390,650),area),null);
 assert.equal(readerTapAction(at(195,390),at(216,390,150),area),null);
 assert.equal(readerTapAction(at(195,390),at(195,390,100,2),area),null);
});
test('top and bottom system gesture zones are ignored',()=>{
 assert.equal(readerTapAction(at(195,25),at(290,25,100),area),null);
 assert.equal(readerTapAction(at(195,755),at(95,755,100),area),null);
});
