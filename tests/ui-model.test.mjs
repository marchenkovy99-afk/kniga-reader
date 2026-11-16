import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../reader/src/anchors.js';
import {filterBooks,searchBook,chapterLabel,resetAppearanceSection,presetFor,appearancePresets,savedItems,filterSaved} from '../reader/src/ui-model.js';

test('shelf searches, filters planned books and sorts without mutating input',()=>{
 const books=[{id:'1',title:'Я',author:'А',addedAt:1,progress:{status:'planned'}},{id:'2',title:'Азбука',author:'Б',addedAt:2}];
 assert.deepEqual(filterBooks(books,{status:'planned'}).map(b=>b.id),['1']);
 assert.deepEqual(filterBooks(books,{sort:'title'}).map(b=>b.id),['2','1']);
 assert.deepEqual(filterBooks(books,{query:'АЗБ'}).map(b=>b.id),['2']);
 assert.deepEqual(books.map(b=>b.id),['1','2']);
});
test('search retains source offsets, matches literal punctuation and bounds its output',()=>{
 const text='Начало длинного предложения. Батюшка сказал: <script> [a+b]. Батюшка ушёл.';
 const book={blocks:[{text}],chapters:[{block:0,title:'Первая'}]};
 const result=searchBook(book,'батюшка',1);
 assert.equal(result.total,2);assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].offset,text.indexOf('Батюшка'));
 assert.equal(result.matches[0].match,'Батюшка');assert.equal(result.matches[0].chapter,'Первая');
 assert.equal(searchBook(book,'[a+b]').total,1);
 assert.equal(searchBook(book,' ').matches.length,0);
});
test('chapter label separates BRs and decodes entities without changing source anchors',()=>{
 const block={html:'Глава I<br/>Сержант &amp; гвардии',text:'Глава IСержант & гвардии'};
 assert.equal(chapterLabel({title:block.text,block:0},[block]),'Глава I · Сержант & гвардии');
 assert.equal(block.text,'Глава IСержант & гвардии');
});
test('reset affects the selected section only and identifies custom presets',()=>{
 const custom={...defaults,fontSize:31,margin:60,theme:'oled'};
 assert.deepEqual(resetAppearanceSection(custom,'page',defaults),{...custom,margin:24,topInset:2,bottomInset:4});
 assert.equal(resetAppearanceSection(custom,'themes',defaults).fontSize,31);
 assert.equal(resetAppearanceSection(custom,'themes',defaults).theme,'paper');
 assert.equal(presetFor(custom),'custom');
 assert.equal(presetFor({...defaults,...appearancePresets.novel}),'novel');
});
test('saved list omits tombstones and filters quotes by book and text',()=>{
 const books=[{id:'a',title:'Книга',author:'Автор',marks:[{anchor:{block:1,offset:0},label:'Место'},{deleted:true}],progress:{annotations:[{id:'q',text:'Цитата',note:'Мысль',start:{block:2,offset:0}},{id:'old',deleted:true}]}}];
 const items=savedItems(books);assert.equal(items.length,2);
 assert.equal(filterSaved(items,{type:'quote',bookId:'a',query:'мысль'})[0].id,'q');
 assert.equal(filterSaved(items,{bookId:'b'}).length,0);
});
