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
 it('keeps legacy block indices for whitespace-only paragraphs and verse lines',()=>{
  const book=parseFB2('<FictionBook><body><section><p>Первый</p><p>  </p><v> </v><subtitle> </subtitle><p>До <emphasis>курсив</emphasis> после</p></section></body></FictionBook>');
  expect(book.chapters[0].blocks.map(block=>'text' in block?block.text:'')).toEqual(['Первый','','','','До курсив после']);
 });
 it('retains safe inline emphasis, namespace-independent footnotes and original flattened text',()=>{
  const parsed=parseFB2(`<FictionBook xmlns:x="http://www.w3.org/1999/xlink"><description><title-info><book-title>Formatting</book-title></title-info></description><body><section><p>До <emphasis>курсив <strong>оба</strong></emphasis> после <a type="note" x:href="#n1">1</a>.</p><poem><stanza><v>Строка <strong>стиха</strong></v></stanza></poem></section></body><body name="notes"><section id="n1"><title><p>1</p></title><p>Полное примечание.</p></section></body></FictionBook>`);
  const block=parsed.chapters[0].blocks[0] as any;
  expect(block.text).toBe('До курсив оба после 1.');
  expect(block.inline.map((run:any)=>run.text).join('')).toBe(block.text);
  expect(block.inline.find((run:any)=>run.text==='оба')).toMatchObject({strong:true,emphasis:true});
  expect(block.inline.find((run:any)=>run.text==='1')).toMatchObject({note:'n1'});
  expect((parsed as any).notes.n1).toContain('Полное примечание.');
  expect(parsed.chapters[0].blocks[1]).toMatchObject({kind:'verse',text:'Строка стиха'});
 });
 it('resolves images through the actual xlink namespace and deduplicates binary sources',()=>{
  const parsed=parseFB2('<FictionBook xmlns:x="http://www.w3.org/1999/xlink"><body><section><image x:href="#pic"/><p>Текст</p><image x:href="#pic"/></section></body><binary id="pic" content-type="image/png">aGVsbG8=</binary></FictionBook>');
  expect(parsed.chapters[0].blocks[0]).toMatchObject({kind:'image',src:'data:image/png;base64,aGVsbG8='});
 });
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

it('rejects DTD and custom entities before parsing untrusted FB2',()=>{
 expect(()=>parseFB2('<!DOCTYPE FictionBook [<!ENTITY secret "expanded">]><FictionBook><body><section><p>&secret;</p></section></body></FictionBook>')).toThrow(/DTD|DOCTYPE/);
});
