import {test} from 'node:test';import assert from 'node:assert/strict';
import {mergeMarks,newestState,pendingForAccount} from '../reader/src/sync-model.js';
test('bookmarks merge across devices and deleted bookmarks do not reappear',()=>{
 const a={anchor:{block:2,offset:10},label:'A',changedAt:10},b={anchor:{block:5,offset:0},label:'B',changedAt:11};
 const merged=mergeMarks([a,b],[{...a,deleted:true,changedAt:12}]);
 assert.equal(merged.length,2);assert.equal(merged.find(m=>m.anchor.block===2).deleted,true);assert.equal(merged.find(m=>m.anchor.block===5).label,'B');
});
test('old offline state cannot replace newer reading position',()=>{
 const records=[{key:'position:x',clientUpdatedAt:100,payload:{anchor:{block:8,offset:0}}},{key:'position:x',clientUpdatedAt:50,payload:{anchor:{block:2,offset:0}}}];
 assert.equal(newestState(records,'position:x').payload.anchor.block,8);
});

test('guest reading progress is adopted by the first signed-in account',()=>{
 const guest={ 'position:book':{clientUpdatedAt:10,payload:{anchor:{block:2,offset:6}}}};
 const cloud={'settings':{clientUpdatedAt:11,payload:{fontSize:20}}};
 const merged=pendingForAccount(null,'user-a',guest,cloud);
 assert.deepEqual(Object.keys(merged).sort(),['position:book','settings']);
 assert.equal(merged['position:book'].payload.anchor.block,2);
});
test('switching between two Supabase accounts never mixes pending queues',()=>{
 const forA={'position:a':{clientUpdatedAt:20,payload:{anchor:{block:8,offset:1}}}};
 const forB={'position:b':{clientUpdatedAt:30,payload:{anchor:{block:1,offset:0}}}};
 const resolved=pendingForAccount('user-a','user-b',forA,forB);
 assert.deepEqual(Object.keys(resolved),['position:b']);
 assert.deepEqual(Object.keys(forA),['position:a']);
});
test('multiple pending updates retain the most recent record',()=>{
 const first={settings:{clientUpdatedAt:100,payload:{font: 'serif'}}};
 const second={settings:{clientUpdatedAt:120,payload:{font: 'sans'}}};
 assert.equal(pendingForAccount(null,'a',first,second).settings.payload.font,'sans');
 assert.equal(pendingForAccount(null,'a',second,first).settings.payload.font,'sans');
});
