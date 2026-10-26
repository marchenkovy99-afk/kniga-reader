import test from 'node:test';
import assert from 'node:assert/strict';
import {coverDesign,fitCoverText,renderCover} from '../reader/src/covers.js';
const measure=(text,size)=>[...text].length*size*.64;
test('design stays stable across file ids and distinguishes books',()=>{
 const b={title:'Старик и море',author:'Эрнест Хемингуэй'};
 assert.deepEqual(coverDesign(b),coverDesign({...b,id:'different'}));
 assert.notDeepEqual(coverDesign(b),coverDesign({title:'Город лестниц',author:'Роберт Джексон Беннетт'}));
});
test('complete Russian titles fit without splitting ordinary words',()=>{
 for(const text of ['Старик и море','Город лестниц','Мальчик, которого растили как собаку','Очень длинное название книги с дополнительными словами и пояснениями']){
  const fit=fitCoverText(text,{width:192,height:166,maxSize:34,measure});
  assert.equal(fit.lines.join(' '),text);
  assert.ok(fit.lines.length*fit.size*1.16<=166);
  assert.ok(fit.lines.every(line=>measure(line,fit.size)<=192));
 }
});
test('long single words shrink to fit without losing characters',()=>{
 const text='Сверхдлинноенеразрывноеназвание';
 const fit=fitCoverText(text,{width:192,height:166,maxSize:34,measure});
 assert.equal(fit.lines.join(' '),text);assert.ok(measure(text,fit.size)<=192);
});
test('embedded artwork preserved and custom raster takes priority',()=>{
 const b={title:'Книга',author:'Автор',cover:'data:image/png;base64,YQ=='};
 assert.match(renderCover(b),/data:image\/png;base64,YQ==/);
 assert.match(renderCover({...b,progress:{coverImage:'data:image/jpeg;base64,Yg=='}}),/data:image\/jpeg;base64,Yg==/);
});
test('book metadata cannot inject markup and unsafe image URL falls back',()=>{
 const html=renderCover({title:'<script>alert(1)</script>',author:'" onload="alert(1)',cover:'javascript:alert(1)'});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('src="javascript:'));
 assert.ok(html.includes('&lt;script&gt;'));
});
