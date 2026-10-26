import test from 'node:test';
import assert from 'node:assert/strict';
import {trackReaderWindow} from '../reader/src/reader-window.js';
function windowHeight({installed=true,width=393,height=778,screenWidth=393,screenHeight=852,visualHeight=height,scale=1,property='--reader-window-height'}={}){
 let value;
 const win={navigator:{standalone:installed,userAgent:'iPhone'},innerWidth:width,innerHeight:height,screen:{width:screenWidth,height:screenHeight},visualViewport:{height:visualHeight,scale,addEventListener(){}},matchMedia:()=>({matches:false}),addEventListener(){}};
 const doc={documentElement:{style:{setProperty:(key,v)=>{if(key===property)value=v;}}},addEventListener(){}};
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

test('installed app uses shorter visual viewport instead of hidden screen pixels',()=>assert.equal(windowHeight({visualHeight:704}),'704px'));
