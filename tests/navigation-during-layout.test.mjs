import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const reader=readFileSync(new URL('../reader/src/main.js',import.meta.url),'utf8');
const jump=reader.slice(reader.indexOf('function jump('),reader.indexOf('function toggleBookmark('));
test('chapter/search jumps queue the requested source anchor during repagination without saving an unseen page',()=>{
 let layouts=0,saves=0,turns=0;
 const context={current:{id:'book'},pages:[{}],pendingJump:null,anchor:{block:0,offset:4},
  document:{querySelector:()=>({dataset:{layoutState:'pending'}})},closeSheet(){},
  scheduleLayout(){layouts++;},scheduleSave(){saves++;},updateProgress(){},goPage(){turns++;},pageForAnchor(){return 0;}};
 vm.createContext(context);vm.runInContext(jump,context);
 context.jump({block:5,offset:12});
 assert.deepEqual({...context.pendingJump},{block:5,offset:12});
 assert.deepEqual({...context.anchor},{block:0,offset:4});
 assert.equal(layouts,1);assert.equal(saves,0);assert.equal(turns,0);
});
