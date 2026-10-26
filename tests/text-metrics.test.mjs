import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTextMeasure} from '../reader/src/text-metrics.js';
test('candidate lines sum token widths and retain source offsets for partial words',()=>{
 const text='абвг два слова',measure=createTextMeasure([{text,start:0,font:'normal'}],value=>value.length);
 for(let from=0;from<text.length;from++)for(let to=from+1;to<=text.length;to++)assert.equal(measure(from,to),to-from);
});
test('inline fonts keep their own widths and repeated source whitespace is collapsed visually',()=>{
 const runs=[{start:0,text:'Один   ',font:'normal'},{start:7,text:'два',font:'bold'},{start:10,text:' три',font:'normal'}];
 const measure=createTextMeasure(runs,(text,font)=>text.length*(font==='bold'?2:1));
 assert.equal(measure(0,14),15);assert.equal(measure(7,10),6);assert.equal(measure(8,10),4);
});
