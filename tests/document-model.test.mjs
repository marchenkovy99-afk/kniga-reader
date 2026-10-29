import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentModel,graphemeBoundaries,assertSourceRanges,migrateAnchor} from '../reader/src/document-model.js';

test('document model freezes source, retains formatting, chapter and stable legacy positions',()=>{
 const source=[{id:'title',type:'h2',text:'Глава',html:'Глава'},{id:'para',type:'p',text:'Ёж 👨‍👩‍👧‍👦 е\u0301',html:'Ёж <em>👨‍👩‍👧‍👦</em> е\u0301',presentation:{italic:true}}];
 const model=createDocumentModel(source,{id:'book'});
 assert.equal(model.blocks[1].chapterId,'title');assert.equal(model.blocks[1].start,5);
 assert.equal(model.blocks[1].end,5+source[1].text.length);assert.equal(model.blocks[1].html,source[1].html);
 source[1].text='changed';assert.notEqual(model.blocks[1].text,source[1].text);
 assert.ok(Object.isFrozen(model.blocks[1]));
 assert.deepEqual(migrateAnchor(model,{block:1,offset:4}),{block:1,offset:3});
 assert.deepEqual(migrateAnchor(model,{blockId:'para',offset:0}),{block:1,offset:0});
});
test('grapheme boundaries preserve combining marks, ZWJ families, flags and skin tones',()=>{
 const text='е\u0301👨‍👩‍👧‍👦🇷🇺👍🏽';
 assert.deepEqual(graphemeBoundaries(text),[0,2,13,17,21]);
});
test('source ranges reject gaps, repetitions, reordering and splits inside graphemes',()=>{
 const model=createDocumentModel([{text:'aе\u0301b',html:'aе\u0301b',type:'p'}]);
 const page=(from,to)=>({fragments:[{block:0,from,to}],start:{block:0,offset:from},end:{block:0,offset:to}});
 assert.doesNotThrow(()=>assertSourceRanges(model,[page(0,3),page(3,4)]));
 for(const ranges of [[page(0,2),page(2,4)],[page(0,1),page(3,4)],[page(0,3),page(1,4)],[page(3,4),page(0,3)]])assert.throws(()=>assertSourceRanges(model,ranges),/целостност|графем/i);
 assert.throws(()=>assertSourceRanges(model,[page(0,3)]),/целостност/i);
 assert.doesNotThrow(()=>assertSourceRanges(model,[page(0,3)],{complete:false}));
});
test('empty image blocks are represented exactly once and version tracks formatted source',()=>{
 const source=[{id:'image',text:'',html:'<img src="data:image/png;base64,AA=="/>',type:'image'},{text:'end',html:'end',type:'p'}];
 const model=createDocumentModel(source);
 const page={fragments:[{block:0,from:0,to:0},{block:1,from:0,to:3}],start:{block:0,offset:0},end:{block:1,offset:3}};
 assert.doesNotThrow(()=>assertSourceRanges(model,[page]));
 assert.notEqual(model.version,createDocumentModel([{...source[0]}, {...source[1],html:'<b>end</b>'}]).version);
});
