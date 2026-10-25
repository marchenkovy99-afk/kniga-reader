import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wordBounds} from '../reader/src/selection-controller.js';
test('long press selects a complete Cyrillic word, excluding punctuation',()=>{
 assert.deepEqual(wordBounds('Тина обеспокоенно изучала.',8),{start:5,end:17});
 assert.deepEqual(wordBounds('слово, другое',4),{start:0,end:5});
});
test('word boundaries handle hyphens, whitespace and final characters',()=>{
 assert.deepEqual(wordBounds('кто-нибудь рядом',5),{start:0,end:10});
 assert.deepEqual(wordBounds('  мир',5),{start:2,end:5});
 assert.equal(wordBounds('   ',1),null);
});
