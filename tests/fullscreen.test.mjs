import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReadingFullscreen} from '../reader/src/reading-fullscreen.js';
test('requests real fullscreen on opening and restores the browser when leaving the reader',async()=>{
 const doc={fullscreenEnabled:true,fullscreenElement:null};
 const root={requestFullscreen:async()=>{doc.fullscreenElement=root;}};doc.documentElement=root;
 let exits=0;doc.exitFullscreen=async()=>{exits++;doc.fullscreenElement=null;};
 const mode=createReadingFullscreen(doc);await mode.enter();assert.equal(doc.fullscreenElement,root);
 await mode.leave();assert.equal(exits,1);assert.equal(doc.fullscreenElement,null);
});
test('unsupported iPhone API and denied requests do not break book opening',async()=>{
 await createReadingFullscreen({documentElement:{}}).enter();
 const mode=createReadingFullscreen({fullscreenEnabled:true,documentElement:{requestFullscreen:()=>Promise.reject(Error('denied'))}});
 await assert.doesNotReject(mode.enter());await assert.doesNotReject(mode.leave());
});
test('does not exit fullscreen that was active before reading',async()=>{
 let exits=0;const doc={fullscreenEnabled:true,fullscreenElement:{},documentElement:{},exitFullscreen:async()=>exits++};
 const mode=createReadingFullscreen(doc);await mode.enter();await mode.leave();assert.equal(exits,0);
});
