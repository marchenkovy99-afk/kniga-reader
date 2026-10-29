import test from 'node:test';
import assert from 'node:assert/strict';
import {readReadingViewport,geometryRepair,sameReadingViewport} from '../reader/src/viewport-manager.js';
const stage=(width=393,height=808)=>({clientWidth:width,clientHeight:height,getBoundingClientRect:()=>({left:0,top:84,right:width,bottom:84+height,width,height})});
test('viewport uses the actual stage, not physical screen or toolbar geometry',()=>{
 const s=readReadingViewport(stage(),{innerWidth:393,innerHeight:894,screen:{height:9999}});
 assert.equal(s.width,393);assert.equal(s.height,808);assert.equal(s.top,84);assert.equal(s.bottom,892);
});
test('repair uses independently measured smaller page bounds, never inflates pixels',()=>{
 const bounds={getBoundingClientRect:()=>({width:390,height:790}),clientWidth:390,clientHeight:790};
 assert.deepEqual(geometryRepair(readReadingViewport(stage()),bounds),{width:390,height:790});
 assert.equal(geometryRepair(readReadingViewport(stage()),stage()),null);
});
test('fractional stage geometry is normalized consistently across repeated reads',()=>{
 const el={clientWidth:393,clientHeight:808,getBoundingClientRect:()=>({left:0,top:84,width:392.75,height:807.75})};
 assert.equal(sameReadingViewport(el,readReadingViewport(el)),true);
 assert.equal(readReadingViewport(el).height,807);
});
test('repair intersects an intermediate clipping sheet as well as the text box',()=>{
 const outer=stage(),sheet={clientWidth:393,clientHeight:780,clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:0,top:84,width:393,height:780,right:393,bottom:864}),parentElement:outer};
 const text={clientWidth:393,clientHeight:808,getBoundingClientRect:()=>({left:0,top:84,width:393,height:808,right:393,bottom:892}),parentElement:sheet,ownerDocument:{defaultView:{getComputedStyle:()=>({overflowX:'hidden',overflowY:'hidden'})}}};
 assert.deepEqual(geometryRepair(readReadingViewport(outer),text,outer),{width:393,height:780});
});
