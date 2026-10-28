import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createAccountState} from '../reader/src/account-state.js';

const reader=readFileSync(new URL('../reader/src/main.js',import.meta.url),'utf8');
function harness({progress={anchor:{block:0,offset:0},updatedAt:100},touched=false}={}){
 const saved=[],queued=[],timers=[];
 const book={id:'test',blocks:Array.from({length:3},()=>({text:'example text'})),progress,marks:[]};
 const store={getPreference:async()=>undefined,setPreference:async(k,v)=>saved.push([k,structuredClone(v)])};
 const accounts=createAccountState(store);
 const context={localOwner:'account-a',localState:owner=>accounts.forOwner(owner||'account-a'),current:book,anchor:{...progress.anchor},readingTouched:touched,
  storage:store,cloud:{queue:(...args)=>queued.push(args)},
  setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},
  updateProgress:()=>{},layout:async()=>{context.layouts++;},layouts:0,message:()=>{},saveTimer:null};
 vm.createContext(context);
 vm.runInContext(reader.slice(reader.indexOf('async function persistPosition()'),reader.indexOf('function progressFor(')),context);
 const callback=reader.slice(reader.indexOf('remotePosition:async(')+'remotePosition:'.length,reader.indexOf(');\n  await cloud.init();'));
 vm.runInContext('globalThis.receive='+callback.slice(0,-1),context);
 return {context,book,saved,queued,timers};
}
test('opening, backgrounding and repagination cannot stamp an old position as a new edit',async()=>{
 const h=harness();await h.context.persistPosition();
 assert.equal(h.book.progress.updatedAt,100);
 assert.equal(h.queued[0][2],100);
 assert.equal(h.queued[0][3],'account-a');
 assert.equal(h.saved[0][0],'account-state:account-a:position:test');
});
test('an untouched newly opened book accepts the newer cloud position',async()=>{
 const h=harness();const next={anchor:{block:2,offset:4},updatedAt:200};
 await h.context.receive(h.book,{payload:next,clientUpdatedAt:200},[],[]);
 assert.equal(h.book.progress.updatedAt,200);
 assert.deepEqual({...h.context.anchor},next.anchor);
 assert.equal(h.context.layouts,1);
 assert.equal(h.queued.length,0,'applying cloud progress must not create a new local edit');
});
test('active local reading stays on its page while a remote session advances',async()=>{
 const h=harness({touched:true});
 await h.context.receive(h.book,{payload:{anchor:{block:2,offset:4}},clientUpdatedAt:200},[],[]);
 assert.deepEqual({...h.context.anchor},{block:0,offset:0});
 assert.equal(h.book.progress.updatedAt,100);
 assert.equal(h.context.layouts,0);
});
test('a genuine user change gets a new timestamp and is sent to the cloud',async()=>{
 const h=harness();h.context.anchor={block:1,offset:2};h.context.scheduleSave();
 await h.timers.at(-1)();
 assert.ok(h.book.progress.updatedAt>100);
 assert.equal(h.context.readingTouched,true);
 assert.deepEqual({...h.book.progress.anchor},{block:1,offset:2});
 assert.equal(h.queued.length,1);
});
