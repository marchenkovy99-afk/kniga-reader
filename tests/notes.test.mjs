import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeAnnotations} from '../reader/src/reading-features.js';
const a={id:'note-1',start:{block:2,offset:3},end:{block:2,offset:15},text:'Example',note:'',changedAt:1};
test('highlights retain source block and character offsets',()=>assert.deepEqual(mergeAnnotations([a])[0].start,a.start));
test('latest edit wins',()=>assert.equal(mergeAnnotations([a],[{...a,note:'updated',changedAt:3}])[0].note,'updated'));
test('deleted highlights cannot be reintroduced by stale device',()=>assert.equal(mergeAnnotations([a],[{...a,deleted:true,changedAt:5}],[a])[0].deleted,true));
test('invalid or negative blocks are ignored',()=>assert.equal(mergeAnnotations([a],[{...a,id:'bad',start:{block:-1,offset:0}}]).length,1));
