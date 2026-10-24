import test from 'node:test';
import assert from 'node:assert/strict';
import {animatedTurn} from '../reader/src/page-turn.js';
const fake=(current=3,opts={})=>{
 const calls=[];
 const engine={
  isReady:()=>opts.ready!==false,isAnimating:()=>opts.animating===true,
  getCurrentPageIndex:()=>current,canTurn:(d)=>opts.blocked!==d,
  flipPrev:(corner)=>{calls.push(['prev',corner]);return true;},
  flipNext:(corner)=>{calls.push(['next',corner]);return true;}
 };
 return {engine,calls};
};
test('backward has the SAME animated book-curl corner as forward',()=>{
 const a=fake(),b=fake();
 assert.equal(animatedTurn(a.engine,-1,6),true);
 assert.equal(animatedTurn(b.engine,1,6),true);
 assert.deepEqual(a.calls,[['prev','bottom']]);
 assert.deepEqual(b.calls,[['next','bottom']]);
});
test('reverse turn uses engine index and cannot cross start',()=>{
 const one=fake(1),zero=fake(0);
 assert.equal(animatedTurn(one.engine,-1,6),true);
 assert.equal(animatedTurn(zero.engine,-1,6),false);
 assert.equal(zero.calls.length,0);
});
test('forward end, animation in progress and disabled turn all respect bounds',()=>{
 const end=fake(5),busy=fake(3,{animating:true}),blocked=fake(3,{blocked:'prev'});
 assert.equal(animatedTurn(end.engine,1,6),false);
 assert.equal(animatedTurn(busy.engine,-1,6),false);
 assert.equal(animatedTurn(blocked.engine,-1,6),false);
 assert.deepEqual(end.calls,[]);assert.deepEqual(busy.calls,[]);assert.deepEqual(blocked.calls,[]);
});
