import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planJustifiedLines} from '../reader/src/justified-lines.js';

test('paragraph planning preserves all source offsets and uses legal word breaks',()=>{
 const text='один два три четыре пять шесть семь восемь девять десять';
 const breaks=[...text.matchAll(/\s+/g)].map(m=>({at:m.index+m[0].length,end:m.index,hyphen:false}));breaks.push({at:text.length,end:text.length,hyphen:false});
 const lines=planJustifiedLines({text,breaks,width:20,spaceWidth:1,hyphenWidth:1,measure:(a,b)=>b-a});
 assert.ok(lines.length>1);assert.equal(lines[0].from,0);assert.equal(lines.at(-1).to,text.length);
 for(let i=1;i<lines.length;i++)assert.equal(lines[i].from,lines[i-1].to);
 assert.equal(lines.map(l=>text.slice(l.from,l.to)).join(''),text);
});
test('unbreakable content wider than the page falls back rather than looping or truncating',()=>{
 assert.equal(planJustifiedLines({text:'abcdefgh',breaks:[{at:8,end:8,hyphen:false}],width:4,spaceWidth:1,hyphenWidth:1,measure:(a,b)=>b-a}),null);
});
