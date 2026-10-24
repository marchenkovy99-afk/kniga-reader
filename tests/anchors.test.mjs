import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageForAnchor,clampSettings } from '../reader/src/anchors.js';
test('same block character anchor finds the new page after repagination',()=>{
 const pages=[{start:{block:0,offset:0},end:{block:1,offset:100}},{start:{block:1,offset:100},end:{block:2,offset:30}},{start:{block:2,offset:30},end:{block:3,offset:0}}];
 assert.equal(pageForAnchor(pages,{block:1,offset:150}),1); assert.equal(pageForAnchor(pages,{block:1,offset:100}),1);
 assert.equal(pageForAnchor(pages,{block:99,offset:0}),2); assert.equal(pageForAnchor(pages,{block:0,offset:0}),0);
});
test('invalid saved settings cannot create unreadable or unsafe layout',()=>{
 const s=clampSettings({fontSize:1000,lineHeight:-1,margin:999,font:'evil',theme:'evil',letterSpacing:Infinity});
 assert.equal(s.fontSize,48); assert.equal(s.lineHeight,1); assert.equal(s.margin,72); assert.equal(s.font,'serif'); assert.equal(s.theme,'paper'); assert.ok(Number.isFinite(s.letterSpacing));
});
