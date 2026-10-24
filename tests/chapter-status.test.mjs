import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chapterReadingStatus} from '../reader/src/reading-features.js';
const pages=Array.from({length:10},(_,block)=>({start:{block,offset:0},end:{block,offset:20}}));
const chapters=[{title:'Первая',block:0,level:1},{title:'Подраздел',block:2,level:2},{title:'Вторая',block:5,level:1}];
test('chapter remaining pages include the displayed page and stop at the next main chapter',()=>{
 assert.deepEqual(chapterReadingStatus(pages,1,chapters),{title:'Первая',remainingPages:4,label:'До конца главы · 4 стр.'});
 assert.equal(chapterReadingStatus(pages,4,chapters).remainingPages,1);
 assert.deepEqual(chapterReadingStatus(pages,5,chapters),{title:'Вторая',remainingPages:5,label:'До конца главы · 5 стр.'});
 assert.equal(chapterReadingStatus(pages,9,chapters).remainingPages,1);
});
test('preface and books without chapter headings have honest fallback labels',()=>{
 assert.equal(chapterReadingStatus(pages,1,[{title:'Начало',block:5,level:1}]).label,'До начала главы · 4 стр.');
 assert.equal(chapterReadingStatus(pages,2,[]).label,'До конца книги · 8 стр.');
 assert.equal(chapterReadingStatus([],0,chapters),null);
});
test('books with only secondary headings still expose chapter progress',()=>{
 assert.equal(chapterReadingStatus(pages,3,[{title:'Раздел',block:0,level:2},{title:'Дальше',block:6,level:2}]).remainingPages,3);
});
test('recalculated page geometry changes chapter totals',()=>{
 const largerText=Array.from({length:20},(_,i)=>({start:{block:Math.floor(i/2),offset:(i%2)*10},end:{block:Math.floor(i/2),offset:(i%2)*10+10}}));
 assert.equal(chapterReadingStatus(largerText,2,chapters).remainingPages,8);
});
