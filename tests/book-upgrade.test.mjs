import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {strToU8} from 'fflate';
import {upgradeBookPresentation} from '../reader/src/book-upgrade.js';
globalThis.DOMParser=DOMParser;
const original=strToU8('<FictionBook><body><section><epigraph><p>Эпиграф.</p></epigraph><p>Обычный текст.</p></section></body></FictionBook>').buffer;
function savedBook(){return {id:'original-id',original,fileName:'book.fb2',blocks:[{id:'b0',type:'p',text:'Эпиграф.',html:'Эпиграф.',sourceId:null},{id:'b1',type:'p',text:'Обычный текст.',html:'Обычный текст.',sourceId:null}],progress:{anchor:{block:1,offset:4},updatedAt:321,annotations:[{start:{block:1,offset:2},end:{block:1,offset:9},note:'Заметка'}]},marks:[{anchor:{block:0,offset:1},changedAt:80}],appearanceSettings:{fontSize:31,margin:8,lineHeight:1.15,letterSpacing:-.2,font:'sans',align:'justify',theme:'night'},appearanceUpdatedAt:222};}
test('existing book gains presentation without changing original, IDs, timestamps, preferences or anchors',async()=>{
 const book=savedBook(),before=structuredClone(book);let written;
 assert.equal(await upgradeBookPresentation(book,{saveBook:async value=>{written=structuredClone(value);}}),true);
 assert.equal(book.blocks[0].presentation.role,'epigraph');assert.equal(book.presentationVersion,1);
 for(const key of ['id','original','progress','marks','appearanceSettings','appearanceUpdatedAt'])assert.deepEqual(book[key],before[key],key);
 assert.deepEqual(book.blocks.map(b=>[b.id,b.type,b.text,b.sourceId]),before.blocks.map(b=>[b.id,b.type,b.text,b.sourceId]));
 assert.deepEqual(written.progress.anchor,{block:1,offset:4});
 let calls=0;await upgradeBookPresentation(book,{saveBook:async()=>calls++});assert.equal(calls,0,'already upgraded book must reopen without reimport/storage writes');
});
test('changed text or source anchors retain the legacy model so old-device positions stay valid',async()=>{
 for(const change of [b=>{b.blocks[0].text='Другой текст';},b=>{b.blocks[0].sourceId='legacy-anchor';},b=>{b.blocks.pop();}]){
  const book=savedBook();change(book);const before=structuredClone(book);
  assert.equal(await upgradeBookPresentation(book,{saveBook:async()=>{}}),false);
  assert.deepEqual(book.blocks,before.blocks);assert.deepEqual(book.progress,before.progress);
 }
});
test('failed upgrade storage or corrupt original does not damage the usable book',async()=>{
 const book=savedBook(),before=structuredClone(book);
 assert.equal(await upgradeBookPresentation(book,{saveBook:async()=>{throw Error('quota');}}),false);
 assert.deepEqual(book,before);
 book.original=new Uint8Array([0,1,2]).buffer;
 assert.equal(await upgradeBookPresentation(book,{saveBook:async()=>{throw Error('should not write');}}),false);
 assert.deepEqual(book.blocks,before.blocks);
});
