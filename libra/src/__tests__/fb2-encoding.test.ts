// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {decodeFB2} from '../fb2Encoding';
import {parseFB2} from '../fb2';
const prefix='<?xml version="1.0" encoding="windows-1251"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>';
const middle='</book-title></title-info></description><body><section><p>';
const suffix='</p></section></body></FictionBook>';
describe('FB2 byte decoding',()=>{
 it('reads explicitly declared Windows-1251 Cyrillic without replacement characters',()=>{
  const bytes=new Uint8Array([
   ...Buffer.from(prefix,'ascii'),
   0xca,0xed,0xe8,0xe3,0xe0,0x20,0xb9,0x31,
   ...Buffer.from(middle,'ascii'),
   0xcf,0xf0,0xe8,0xe2,0xe5,0xf2,0x20,0xec,0xe8,0xf0,0x21,
   ...Buffer.from(suffix,'ascii')
  ]);
  const decoded=decodeFB2(bytes);
  const parsed=parseFB2(decoded);
  expect(parsed.title).toBe('Книга №1');
  expect(parsed.fullText).toContain('Привет мир!');
  expect(decoded).not.toContain('\uFFFD');
 });
 it('accepts UTF-8 and Unicode astral characters',()=>{
  const xml='<?xml version="1.0" encoding="utf-8"?><FictionBook><body><p>Ёж 🦔</p></body></FictionBook>';
  expect(decodeFB2(new TextEncoder().encode(xml))).toBe(xml);
 });
 it('accepts a UTF-16LE BOM and declaration',()=>{
  const xml='<?xml version="1.0" encoding="utf-16"?><FictionBook><body><p>Ёж</p></body></FictionBook>';
  const bytes=new Uint8Array([255,254,...Array.from(xml).flatMap(ch=>{
   const n=ch.charCodeAt(0);return [n&255,n>>>8];
  })]);
  expect(decodeFB2(bytes)).toBe(xml);
 });
 it('fails loudly instead of losing invalid UTF-8 characters',()=>{
  expect(()=>decodeFB2(new Uint8Array([0x3c,0x70,0x3e,0xff,0x3c,0x2f,0x70,0x3e]))).toThrow('кодировку');
 });
});
