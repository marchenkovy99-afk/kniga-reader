import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { zipSync, strToU8 } from 'fflate';
import { importBook } from '../reader/src/importer.js';
globalThis.DOMParser = DOMParser;
const fb2 = `<?xml version="1.0" encoding="utf-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink"><description><title-info><book-title>Проверка</book-title><author><first-name>Иван</first-name><last-name>Тестов</last-name></author></title-info></description><body><section id="c1"><title><p>Первая глава</p></title><p>Начало <emphasis>курсивом</emphasis> и <strong>жирным</strong>. <a l:href="#n1" type="note">1</a></p><p>Последний абзац.</p></section></body><body name="notes"><section id="n1"><title><p>1</p></title><p>Полный текст примечания.</p></section></body></FictionBook>`;
const parse = (text, name='book.fb2') => importBook(strToU8(text), name);
test('FB2 retains ordered chapters, paragraphs, emphasis and full notes', async()=> {
 const b = await parse(fb2);
 assert.equal(b.title,'Проверка'); assert.equal(b.author,'Иван Тестов');
 assert.equal(b.blocks.map(x=>x.text).join('|'),'Первая глава|Начало курсивом и жирным. 1|Последний абзац.|1|Полный текст примечания.');
 assert.match(b.blocks[1].html, /<em>курсивом<\/em>/); assert.match(b.blocks[1].html, /<strong>жирным<\/strong>/);
 assert.ok(b.blocks.some(x=>x.sourceId==='n1')); assert.match(b.blocks[1].html,/data-note="n1"/);
});
test('rejects malformed XML and DTD instead of silently importing', async()=> {
 await assert.rejects(parse('<FictionBook><body><p>сломано</body>'), /поврежд|XML/i);
 await assert.rejects(parse('<!DOCTYPE x [<!ENTITY test SYSTEM "file:///etc/passwd">]><FictionBook><body><p>&test;</p></body></FictionBook>'),/DTD|DOCTYPE/i);
});
test('FB2.zip is detected and retains the same full text', async()=>{
 const b = await importBook(zipSync({'test.fb2':strToU8(fb2)}),'test.fb2.zip');
 assert.equal(b.blocks.at(-1).text,'Полный текст примечания.');
});
test('TXT preserves all paragraphs and unsafe text as text', async()=> {
 const b = await parse('Первый абзац.\n\n<script>alert(1)</script>\n\nПоследний.', 'plain.txt');
 assert.equal(b.blocks.map(x=>x.text).join('|'),'Первый абзац.|<script>alert(1)</script>|Последний.');
 assert.doesNotMatch(b.blocks[1].html,/<script>/);
});
function epubFile({evil=false,fixed=false,encrypted=false}={}) {
 return zipSync({
 'META-INF/container.xml':strToU8('<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>'),
 'OPS/book.opf':strToU8(`<package><metadata><title>EPUB-тест</title><creator>Автор</creator>${fixed?'<meta property="rendition:layout">pre-paginated</meta>':''}</metadata><manifest><item id="one" href="text/one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="text/two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="two"/><itemref idref="one"/></spine></package>`),
 'OPS/text/one.xhtml':strToU8(`<html><body><h1>Первая</h1><p>Текст <em>главы</em>.</p>${evil?'<script>alert(1)</script><img src="https://evil.test/pixel" onerror="alert(1)"/><iframe src="https://evil.test"/>':''}</body></html>`),
 'OPS/text/two.xhtml':strToU8('<html><body><h1>Вторая</h1><p>В начале по spine.</p><p><a href="one.xhtml#note">Сноска</a></p></body></html>'),
 ...(encrypted?{'META-INF/encryption.xml':strToU8('<encryption/>')}:{}),
 });
}
test('EPUB follows spine order and preserves formatted text and cross-file links', async()=> {
 const b=await importBook(epubFile(),'a.epub'); assert.equal(b.title,'EPUB-тест');
 assert.equal(b.blocks[0].text,'Вторая'); assert.equal(b.blocks.at(-1).text,'Текст главы.');
 assert.match(b.blocks.at(-1).html,/<em>главы<\/em>/); assert.match(b.blocks[2].html,/data-note=/);
});
test('EPUB strips executable markup and network resources',async()=>{
 const b=await importBook(epubFile({evil:true}),'evil.epub'); const html=b.blocks.map(x=>x.html).join('');
 assert.doesNotMatch(html,/<script|onerror|iframe|https:\/\/evil/); assert.ok(b.warnings.length);
});
test('fixed-layout and encrypted EPUB are rejected with an explanation',async()=>{
 await assert.rejects(importBook(epubFile({fixed:true}),'a.epub'),/фиксирован/i);
 await assert.rejects(importBook(epubFile({encrypted:true}),'a.epub'),/защищ|шифр|DRM/i);
});
test('unsupported files and oversized files fail explicitly',async()=>{
 await assert.rejects(importBook(strToU8('test'),'a.pdf'),/формат/i);
 await assert.rejects(importBook(new Uint8Array(20*1024*1024+1),'large.fb2'),/20/);
});
test('ZIP entry sizes are checked before inflation',async()=>{
 const z=zipSync({'bomb.fb2':new Uint8Array(61*1024*1024)});
 await assert.rejects(importBook(z,'bomb.fb2.zip'),/60|распаков/i);
});
