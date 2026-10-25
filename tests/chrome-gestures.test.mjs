import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attachReaderChrome} from '../reader/src/chrome-controls.js';
class Target extends EventTarget{closest(){return null;}}
function fixture(nativeDrag){
 const old={Element:globalThis.Element,document:globalThis.document,window:globalThis.window};
 globalThis.Element=Target;globalThis.document={querySelector:()=>null};globalThis.window={getSelection:()=>({toString:()=>''})};
 const calls=[],stage=new Target();stage.isConnected=true;
 const reader={classList:{add:()=>{},toggle:()=>calls.push('toggle')}};
 stage.closest=selector=>selector==='.reader'?reader:null;stage.getBoundingClientRect=()=>({left:0,top:0,width:390,height:780});
 attachReaderChrome(stage,dir=>calls.push(dir),{nativeDrag:()=>nativeDrag});
 const event=(type,x,y)=>{const e=new Event(type);Object.assign(e,{pointerId:1,pointerType:'touch',isPrimary:true,clientX:x,clientY:y});stage.dispatchEvent(e);};
 const restore=()=>{for(const [key,value] of Object.entries(old))if(value===undefined)delete globalThis[key];else globalThis[key]=value;};
 return {stage,calls,event,restore};
}
test('native drag owns swipes and the app cannot issue a second page turn',async()=>{
 const f=fixture(true);try{f.event('pointerdown',330,400);f.event('pointerup',80,400);await Promise.resolve();assert.deepEqual(f.calls,[]);}finally{f.restore();}
});
test('tap navigation waits for engine pointer cleanup and still turns exactly once',async()=>{
 const f=fixture(true);try{f.stage.addEventListener('pointerup',()=>f.calls.push('engine-cleanup'));f.event('pointerdown',330,400);f.event('pointerup',334,402);await Promise.resolve();assert.deepEqual(f.calls,['engine-cleanup']);await new Promise(r=>setTimeout(r,0));assert.deepEqual(f.calls,['engine-cleanup',1]);}finally{f.restore();}
});
test('instant mode keeps a working swipe fallback and central taps still toggle the panel',async()=>{
 const f=fixture(false);try{f.event('pointerdown',330,400);f.event('pointerup',80,400);await new Promise(r=>setTimeout(r,0));f.event('pointerdown',195,400);f.event('pointerup',195,400);await new Promise(r=>setTimeout(r,0));assert.deepEqual(f.calls,[1,'toggle']);}finally{f.restore();}
});
