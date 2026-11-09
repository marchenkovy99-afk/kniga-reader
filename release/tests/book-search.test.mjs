import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTextIndex,findMatches} from '../src/book-search-core.js';

test('finds a Russian phrase across whitespace and preserves source offsets',()=>{
 const index=createTextIndex([{text:'Всё  ещё\n здесь. Всё ещё здесь.',block:4}]);
 const hits=findMatches(index,'ВСЕ ЕЩЕ здесь.');
 assert.equal(hits.length,2);
 assert.equal(index.text.slice(hits[0].start,hits[0].end),'Всё  ещё\n здесь.');
 assert.equal(hits[0].first.unit.block,4);
 assert.equal(hits[1].first.offset,17);
});
test('matches formatted text without inventing spaces and sentences across paragraphs',()=>{
 const index=createTextIndex([{text:'Руко',node:1},{text:'писи',separatorBefore:'',node:2},{text:'не горят.',node:3},{text:'Так и есть.',node:4}]);
 const hits=findMatches(index,'рукописи не горят. Так');
 assert.equal(hits.length,1);assert.equal(hits[0].first.unit.node,1);assert.equal(hits[0].last.unit.node,4);assert.equal(hits[0].last.offset,3);
});
test('search treats regex symbols and HTML as plain text',()=>{
 const index=createTextIndex([{text:'[a+b] <img> [a+b]'}]);
 assert.equal(findMatches(index,'[a+b]').length,2);assert.equal(findMatches(index,'<img>')[0].end,11);
});
test('empty or whitespace query returns no results',()=>{
 const index=createTextIndex([{text:'Текст'}]);for(const q of ['','  ','\n'])assert.deepEqual(findMatches(index,q),[]);
});
test('soft hyphens do not prevent matching or shift the original range',()=>{
 const index=createTextIndex([{text:'руко\u00adписи не горят'}]);const [hit]=findMatches(index,'рукописи');assert.equal(hit.end,9);
});
test('bounds repeated results and supports cancellation',()=>{
 const index=createTextIndex([{text:'а '.repeat(30000)}]);assert.equal(findMatches(index,'а',{limit:10000}).length,10000);
 const controller=new AbortController();controller.abort();assert.throws(()=>findMatches(index,'а',{signal:controller.signal}),{name:'AbortError'});
});
