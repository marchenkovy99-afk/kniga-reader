import {test} from 'node:test';import assert from 'node:assert/strict';
import {mergeMarks,newestState} from '../reader/src/sync-model.js';
test('bookmarks merge across devices and deleted bookmarks do not reappear',()=>{
 const a={anchor:{block:2,offset:10},label:'A',changedAt:10},b={anchor:{block:5,offset:0},label:'B',changedAt:11};
 const merged=mergeMarks([a,b],[{...a,deleted:true,changedAt:12}]);
 assert.equal(merged.length,2);assert.equal(merged.find(m=>m.anchor.block===2).deleted,true);assert.equal(merged.find(m=>m.anchor.block===5).label,'B');
});
test('old offline state cannot replace newer reading position',()=>{
 const records=[{key:'position:x',clientUpdatedAt:100,payload:{anchor:{block:8,offset:0}}},{key:'position:x',clientUpdatedAt:50,payload:{anchor:{block:2,offset:0}}}];
 assert.equal(newestState(records,'position:x').payload.anchor.block,8);
});
