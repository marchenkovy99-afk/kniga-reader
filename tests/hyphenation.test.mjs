import {test} from 'node:test';
import assert from 'node:assert/strict';
import {russianHyphenOffsets} from '../reader/src/hyphenation.js';

test('Russian dictionary provides discretionary breaks with at least two letters on either side',()=>{
 for(const word of ['безопасность','невиновным','психологическую','программа','ребёнок','БЕЗОПАСНОСТЬ']){
  const points=russianHyphenOffsets(word);
  assert.ok(points.length>0,word);
  assert.ok(points.every(p=>p>=2&&p<=word.length-2));
  assert.deepEqual(points,[...new Set(points)].sort((a,b)=>a-b));
 }
 assert.deepEqual(russianHyphenOffsets('безопасность'),[3,7]);
});
test('short words, non-Russian tokens, links and identifiers are not split',()=>{
 for(const word of ['я','что','123456','https://example.ru','русский-текст','abcDEF','а'.repeat(81)])assert.deepEqual(russianHyphenOffsets(word),[]);
});
