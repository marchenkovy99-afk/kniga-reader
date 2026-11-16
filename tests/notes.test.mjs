import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeAnnotations} from '../reader/src/reading-features.js';
const a={id:'note-1',start:{block:2,offset:3},end:{block:2,offset:15},text:'Example',note:'',changedAt:1};
test('highlights retain source block and character offsets',()=>assert.deepEqual(mergeAnnotations([a])[0].start,a.start));
test('latest edit wins',()=>assert.equal(mergeAnnotations([a],[{...a,note:'updated',changedAt:3}])[0].note,'updated'));
test('deleted highlights cannot be reintroduced by stale device',()=>assert.equal(mergeAnnotations([a],[{...a,deleted:true,changedAt:5}],[a])[0].deleted,true));
test('invalid or negative blocks are ignored',()=>assert.equal(mergeAnnotations([a],[{...a,id:'bad',start:{block:-1,offset:0}}]).length,1));

test('quote text uses original source and keeps paragraph breaks',async()=>{
 const {sourceQuoteText}=await import('../reader/src/reading-features.js');
 const book={blocks:[{text:'Первая строка.'},{text:'Второй абзац.'}]};
 assert.equal(sourceQuoteText(book,{block:0,offset:7},{block:1,offset:6}),'строка.\n\nВторой');
});
test('annotation changes use monotonic timestamps and undo beats a deletion',async()=>{
 const {changeAnnotation}=await import('../reader/src/reading-features.js');
 const future={...a,changedAt:Date.now()+100000};
 const deleted=changeAnnotation([future],a.id,{deleted:true},1);
 assert.equal(deleted[0].deleted,true);assert.equal(deleted[0].changedAt,future.changedAt+1);
 const restored=changeAnnotation(deleted,a.id,{deleted:false},2);
 assert.equal(restored[0].deleted,false);assert.equal(restored[0].changedAt,future.changedAt+2);
 assert.equal(mergeAnnotations(restored,deleted)[0].deleted,false);
});
test('same-range quote detection avoids duplicate annotations',async()=>{
 const {annotationForRange}=await import('../reader/src/reading-features.js');
 assert.equal(annotationForRange([a],a)?.id,a.id);
 assert.equal(annotationForRange([{...a,deleted:true}],a),null);
});
