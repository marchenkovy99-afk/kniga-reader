// @vitest-environment jsdom
import { describe,it,expect } from 'vitest';
import { parseFB2 } from '../fb2';
const sample=`<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
 <description><title-info><book-title>Тихая книга</book-title><author><first-name>Анна</first-name><last-name>Иванова</last-name></author></title-info></description>
 <body><section><title><p>Первая глава</p></title><p>Первый абзац: Ёж 🦔.</p><p>Второй абзац.</p>
 <section><title><p>Часть 2</p></title><p>Последний абзац.</p></section></section></body>
</FictionBook>`;
describe('FB2',()=>{
 it('reads nested chapters without lost paragraphs',()=>{
  const book=parseFB2(sample);
  expect(book.title).toBe('Тихая книга');
  expect(book.author).toBe('Анна Иванова');
  expect(book.chapters).toHaveLength(2);
  expect(book.fullText).toContain('Первый абзац: Ёж 🦔.');
  expect(book.fullText).toContain('Последний абзац.');
  expect(book.fullText.match(/Второй абзац/g)).toHaveLength(1);
 });
 it('keeps section headings, images inside paragraphs, tables and later text in order',()=>{
  const xml=`<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description><title-info><book-title>Иллюстрации</book-title></title-info></description>
  <body><section><title><p>Заголовок</p></title>
   <p>До <image l:href="#cover" xmlns:l="http://www.w3.org/1999/xlink"/> После</p>
   <table><tr><td>Левая ячейка</td><td>Правая ячейка</td></tr></table>
   <poem><stanza><v>Строка один</v><v>Строка два</v></stanza></poem>
   <p>Последний абзац</p></section></body>
  <binary id="cover" content-type="image/png">aGVsbG8=</binary>
  </FictionBook>`;
  const book=parseFB2(xml);
  expect(book.chapters).toHaveLength(1);
  const kinds=book.chapters[0].blocks.map(block=>block.kind);
  expect(kinds).toEqual(['heading','paragraph','image','paragraph','table','verse','verse','paragraph']);
  expect(book.fullText).toContain('Заголовок');
  expect(book.fullText).toContain('Последний абзац');
  expect(book.fullText.indexOf('До')).toBeLessThan(book.fullText.indexOf('После'));
  expect(book.fullText).toContain('Левая ячейка Правая ячейка');
 });
 it('rejects broken XML',()=>expect(()=>parseFB2('<FictionBook><body>')).toThrow());
 it('rejects unsupported documents',()=>expect(()=>parseFB2('<html/>')).toThrow());
});
