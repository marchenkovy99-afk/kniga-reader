import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/book-search-core.js';

test('large chapter indexing yields and preserves original UTF-16 match ranges',async()=>{
 assert.equal(typeof core.createTextIndexAsync,'function','indexing must expose a cooperative path');
 const units=[{text:' '.repeat(4095)+'😀Ёлка\u00ad\n ',block:0},{text:'следующая\u00a0строка '+ 'а'.repeat(18000),block:1}];
 let yields=0;
 const actual=await core.createTextIndexAsync(units,{yieldTask:async()=>{yields++;}});
 const expected=core.createTextIndex(units);
 assert.deepEqual(actual,expected);
 assert.ok(yields>=2,'a large single chapter must release the event loop repeatedly');
 assert.deepEqual(core.findMatches(actual,'елка следующая строка'),core.findMatches(expected,'елка следующая строка'));
 const hits=core.findMatches(actual,'елка следующая строка');
 assert.equal(hits.length,1);
 assert.equal(hits[0].start,4097,'emoji occupies two UTF-16 code units before the match');
 assert.equal(hits[0].end,units[0].text.length+1+'следующая\u00a0строка'.length);
 assert.equal(actual.entries[0].unit,units[0],'source node identity must survive indexing');
});

test('default indexing scheduler allows an input task to abort a large chapter',async()=>{
 const controller=new AbortController();let inputRan=false;
 const input=setTimeout(()=>{inputRan=true;controller.abort();},0);
 try{
  await assert.rejects(core.createTextIndexAsync([{text:'книга '.repeat(100000)}],{signal:controller.signal}),{name:'AbortError'});
  assert.equal(inputRan,true);
 }finally{clearTimeout(input);}
});

test('closing search interrupts indexing within a single large chapter',async()=>{
 assert.equal(typeof core.createTextIndexAsync,'function','indexing must support interruption');
 const controller=new AbortController();let yields=0;
 await assert.rejects(core.createTextIndexAsync([{text:'Текст '.repeat(100000)}],{
  signal:controller.signal,yieldTask:async()=>{if(++yields===2)controller.abort();}
 }),{name:'AbortError'});
 assert.equal(yields,2,'no remaining chapter work after cancellation');
});

test('cooperative indexing handles empty input and rejects already canceled work',async()=>{
 assert.equal(typeof core.createTextIndexAsync,'function');
 assert.deepEqual(await core.createTextIndexAsync([]),core.createTextIndex([]));
 const controller=new AbortController();controller.abort();
 await assert.rejects(core.createTextIndexAsync([{text:'text'}],{signal:controller.signal}),{name:'AbortError'});
});
