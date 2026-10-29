// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {loadParsedFB2,seedParsedFB2,forgetParsedFB2} from '../reader/parsedFB2Cache';
import {parseFB2} from '../fb2';
import type {StoredBook} from '../domain';
const xml='<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>Тест</book-title></title-info></description><body><section><p>Содержимое</p></section></body></FictionBook>';
const book=(id:string):StoredBook=>({id,filename:'book.fb2',title:'Тест',author:'Автор',format:'fb2',file:({arrayBuffer:async()=>new TextEncoder().encode(xml).buffer} as unknown as Blob),importedAt:1,bookmarks:[]});
describe('parsed book LRU',()=>{
 it('returns the same parsed book in one session without reparsing',async()=>{
  const saved=book('lru-test');
  const first=await loadParsedFB2(saved);
  const second=await loadParsedFB2(saved);
  expect(second).toBe(first);
  forgetParsedFB2(saved.id);
 });
 it('can seed from import metadata and forget on deletion',async()=>{
  const doc=parseFB2(xml),saved=book('seed-test');
  seedParsedFB2(saved.id,doc);
  expect(await loadParsedFB2(saved)).toBe(doc);
  forgetParsedFB2(saved.id);
  expect(await loadParsedFB2(saved)).not.toBe(doc);
  forgetParsedFB2(saved.id);
 });
});
