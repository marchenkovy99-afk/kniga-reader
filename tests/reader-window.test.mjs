import test from 'node:test';
import assert from 'node:assert/strict';
import {trackReaderWindow} from '../reader/src/reader-window.js';
import * as readerWindow from '../reader/src/reader-window.js';
function windowHeight({installed=true,width=393,height=778,screenWidth=393,screenHeight=852,visualHeight=height,cssHeight=height,scale=1,property='--reader-window-height'}={}){
 let value;
 const win={navigator:{standalone:installed,userAgent:'iPhone'},innerWidth:width,innerHeight:height,screen:{width:screenWidth,height:screenHeight},visualViewport:{height:visualHeight,scale,addEventListener(){}},matchMedia:()=>({matches:false}),addEventListener(){}};
 const doc={documentElement:{clientHeight:cssHeight,style:{setProperty:(key,v)=>{if(key===property)value=v;}}},addEventListener(){}};
 trackReaderWindow(win,doc);return value;
}
test('installed iPhone never allocates text below the visible viewport',()=>assert.equal(windowHeight(),'778px'));
test('browser uses its visible viewport',()=>assert.equal(windowHeight({installed:false}),'778px'));
test('split windows do not expand to the physical screen',()=>assert.equal(windowHeight({screenWidth:1024,screenHeight:1366}),'778px'));
test('keyboard-sized viewport reductions remain constrained',()=>assert.equal(windowHeight({height:450}),'450px'));
test('landscape screen dimensions follow the window orientation',()=>assert.equal(windowHeight({width:852,height:350}),'350px'));
test('zoom retains the visible viewport geometry',()=>assert.equal(windowHeight({scale:2}),'778px'));

test('controls stay inside the shorter interactive viewport',()=>assert.equal(windowHeight({property:'--reader-controls-inset'}),'0px'));
test('controls need no extra inset in ordinary browser windows',()=>assert.equal(windowHeight({installed:false,property:'--reader-controls-inset'}),'0px'));

test('installed app uses available CSS viewport despite a stale short visual viewport',()=>assert.equal(windowHeight({visualHeight:704}),'778px'));
test('ordinary browser tabs still honor the short visual viewport',()=>assert.equal(windowHeight({installed:false,visualHeight:704}),'704px'));
test('standalone PWA recovers full CSS viewport when iOS innerHeight is stale and short',()=>assert.equal(windowHeight({height:778,cssHeight:852,visualHeight:852}),'852px'));
test('browser tab does not extrapolate beyond innerHeight',()=>assert.equal(windowHeight({installed:false,height:778,cssHeight:852,visualHeight:852}),'778px'));
test('installed app keeps short visual viewport when on-screen keyboard is focused',()=>{
 const win={navigator:{standalone:true},innerWidth:393,innerHeight:778,visualViewport:{height:470,scale:1,addEventListener(){}},addEventListener(){}};
 let height;const doc={activeElement:{tagName:'INPUT'},documentElement:{clientHeight:778,style:{setProperty:(key,value)=>{if(key==='--reader-window-height')height=value;}}},addEventListener(){}};
 trackReaderWindow(win,doc);assert.equal(height,'470px');
});
test('installed PWA must not extend past a genuinely shorter CSS viewport',()=>{
 const win={navigator:{standalone:true},innerWidth:393,innerHeight:852,visualViewport:{height:704,scale:1,addEventListener(){}},addEventListener(){}};
 let height;const doc={documentElement:{clientHeight:803,style:{setProperty:(key,value)=>{if(key==='--reader-window-height')height=value;}}},addEventListener(){}};
 trackReaderWindow(win,doc);assert.equal(height,'803px');
});
test('viewport changes invalidate the old page before the new window height is applied',()=>{
 const events=new Map(),log=[];
 const win={innerHeight:852,visualViewport:{height:852,addEventListener(){}},addEventListener:(name,fn)=>events.set(name,fn)};
 const doc={documentElement:{style:{setProperty:(key,value)=>log.push([key,value])}},addEventListener(){}};
 trackReaderWindow(win,doc,()=>log.push(['invalidate']));log.length=0;
 win.innerHeight=393;win.visualViewport.height=393;events.get('resize')();
 assert.deepEqual(log[0],['invalidate']);
 assert.deepEqual(log[1],['--reader-window-height','393px']);
 log.length=0;win.innerWidth=320;events.get('resize')();
 assert.deepEqual(log[0],['invalidate'],'width-only changes invalidate old line wraps too');
});
test('the paint guard follows CSS viewport sizes even when iOS JS and CSS heights disagree',()=>{
 assert.equal(typeof readerWindow.viewportPaintQuery,'function');
 const fake=(width,height,cssHeight)=>({innerWidth:width,innerHeight:height,matchMedia:query=>{
  const [,minimum,axis,value]=query.match(/^\((min-)?(width|height):(\d+)px\)$/);
  const actual=axis==='width'?width:cssHeight;
  return {matches:minimum?actual>=Number(value):actual===Number(value)};
 }});
 assert.equal(readerWindow.viewportPaintQuery(fake(393,852,852)),'(min-width:393px) and (min-height:852px)');
 assert.equal(readerWindow.viewportPaintQuery(fake(393,852,803)),'(min-width:393px) and (min-height:803px)');
});
