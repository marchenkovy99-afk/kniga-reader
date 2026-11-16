import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTypography} from '../reader/src/typography.js';
import {defaults} from '../reader/src/anchors.js';
test('compact line boxes reserve a safe descender gap below the last glyph',()=>{
 const painted={};const element={style:{setProperty:(name,value)=>painted[name]=value},dataset:{}};
 applyTypography(element,{...defaults,lineHeight:1.1,bottomInset:0},393);
 assert.ok(parseFloat(painted['padding-bottom'])>=6,'WebKit glyph overhang needs at least six painted pixels at 1.1 line height');
});
