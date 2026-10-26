import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {assertPageIntegrity} from '../reader/src/page-integrity.js';
const readFragments=html=>{
 const doc=new DOMParser().parseFromString('<root>'+html+'</root>','text/xml');
 return [...doc.getElementsByTagName('div')].filter(n=>n.hasAttribute('data-block')).map(n=>({block:Number(n.getAttribute('data-block')),from:Number(n.getAttribute('data-from')),to:Number(n.getAttribute('data-to')),text:n.textContent}));
};
const blocks=[{text:'Первая строка. Вторая строка.'},{text:'Третий абзац.'}];
const part=(block,from,to,text=blocks[block].text.slice(from,to))=>`<div data-block="${block}" data-from="${from}" data-to="${to}">${text}</div>`;
const pages=()=>[{html:part(0,0,15),start:{block:0,offset:0},end:{block:0,offset:15}},{html:part(0,15,29)+part(1,0,13),start:{block:0,offset:15},end:{block:1,offset:13}}];
test('page fragments reproduce every source character in exact order',()=>assert.doesNotThrow(()=>assertPageIntegrity(blocks,pages(),readFragments)));
test('missing visible lines cannot be hidden by seemingly valid page anchors',()=>{
 const p=pages();p[1].html=part(1,0,13);assert.throws(()=>assertPageIntegrity(blocks,p,readFragments),/целостность/i);
});
test('clipped, duplicated or changed page fragments fail integrity verification',()=>{
 for(const html of [part(0,15,29,'Вторая'),part(0,14,29),part(0,15,29,'Измененный текст')]){
  const p=pages();p[1].html=html+part(1,0,13);assert.throws(()=>assertPageIntegrity(blocks,p,readFragments),/целостность/i);
 }
});
test('incorrect cached page start cannot skip a source range',()=>{
 const p=pages();p[1].start.offset=20;assert.throws(()=>assertPageIntegrity(blocks,p,readFragments),/целостность/i);
});
