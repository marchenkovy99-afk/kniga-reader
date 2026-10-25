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
test('FB2 keeps epigraph, attribution, quotation and stanza presentation without changing block text',async()=>{
 const b=await parse('<FictionBook><body><section><epigraph><p>Эпиграф.</p><text-author>Автор</text-author></epigraph><cite><p>Цитата.</p></cite><poem><stanza><v>Первая строка</v><v>Вторая строка</v></stanza></poem><p>Обычный текст.</p></section></body></FictionBook>');
 assert.deepEqual(b.blocks.map(x=>x.text),['Эпиграф.','Автор','Цитата.','Первая строкаВторая строка','Обычный текст.']);
 assert.deepEqual(b.blocks.map(x=>x.presentation?.role||''),['epigraph','attribution','quote','verse','']);
 assert.match(b.blocks[3].html,/Первая строка<br\/>Вторая строка/);
 assert.equal(b.presentationVersion,1);
});
test('EPUB reads safe local presentation styles but never imports publisher sizes, fonts or executable CSS',async()=>{
 const files={
  'META-INF/container.xml':strToU8('<container><rootfile full-path="OPS/book.opf"/></container>'),
  'OPS/book.opf':strToU8('<package><metadata><title>Стиль</title></metadata><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/><item id="css" href="styles/book.css" media-type="text/css"/></manifest><spine><itemref idref="c"/></spine></package>'),
  'OPS/styles/book.css':strToU8('.epigraph p {text-align:right;font-size:99px;font-family:evil;color:red;background:url(https://evil.test);} .emph {font-style:italic;font-weight:700}'),
  'OPS/c.xhtml':strToU8('<html><head><link rel="stylesheet" href="styles/book.css"/><style>.caption {text-align:center}</style></head><body><div class="epigraph"><p>Текст эпиграфа</p><p class="attribution">Автор</p></div><p>Обычный <span class="emph">акцент</span>.</p><figure><img src="pic.png"/><figcaption class="caption">Подпись</figcaption></figure></body></html>'),
  'OPS/pic.png':new Uint8Array([137,80,78,71]),
 };
 const b=await importBook(zipSync(files),'styles.epub');
 assert.equal(b.blocks[0].presentation.role,'epigraph');assert.equal(b.blocks[0].presentation.align,'right');
 assert.equal(b.blocks[1].presentation.role,'attribution');
 assert.equal(b.blocks.at(-1).presentation.role,'caption');assert.equal(b.blocks.at(-1).presentation.align,'center');
 assert.match(b.blocks[2].html,/book-italic/);assert.match(b.blocks[2].html,/book-bold/);
 assert.doesNotMatch(JSON.stringify(b.blocks),/99px|font-family|evil\.test|background:|color:red/);
 assert.equal(b.blocks[2].text,'Обычный акцент.');
});
test('preformatted text retains significant whitespace while ordinary source alignment cannot override reader preferences',async()=>{
 const b=await parse('<FictionBook><body><p style="text-align:right;font-size:90px">Проза</p><pre>строка  с пробелами\n  вторая строка</pre></body></FictionBook>');
 assert.equal(b.blocks[0].presentation.align,undefined);
 assert.equal(b.blocks[1].text,'строка  с пробелами\n  вторая строка');
 assert.equal(b.blocks[1].presentation.role,'preformatted');
});
test('conventional XHTML EPUB declarations and common HTML entities open without external DTD resolution',async()=>{
 const wrap=source=>zipSync({
  'META-INF/container.xml':strToU8('<container><rootfile full-path="book.opf"/></container>'),
  'book.opf':strToU8('<package><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>'),
  'c.xhtml':strToU8(source),
 });
 for(const declaration of ['<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">','<!DOCTYPE html SYSTEM "https://example.test/xhtml.dtd">']){
  const b=await importBook(wrap('<?xml version="1.0"?><!-- EPUB -->'+declaration+'<html><body><p>Текст&nbsp;&mdash; цитата&hellip;</p><pre><![CDATA[&nbsp; <!DOCTYPE html>]]></pre></body></html>'),'compat.epub');
  assert.equal(b.blocks[0].text,'Текст\u00a0— цитата…');
  assert.equal(b.blocks[1].text,'&nbsp; <!DOCTYPE html>','CDATA examples must remain literal');
 }
 await assert.rejects(importBook(wrap('<!DOCTYPE html [<!ENTITY secret SYSTEM "file:///secret">]><html><body><p>&secret;</p></body></html>'),'unsafe.epub'),/DTD|DOCTYPE/);
});
