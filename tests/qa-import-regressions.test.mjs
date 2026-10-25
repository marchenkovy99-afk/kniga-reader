import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {strToU8,zipSync} from 'fflate';
import {importBook} from '../reader/src/importer.js';
import {upgradeBookPresentation} from '../reader/src/book-upgrade.js';
globalThis.DOMParser=DOMParser;
const parse=source=>importBook(strToU8(`<FictionBook><body>${source}</body></FictionBook>`),'qa.fb2');
function epub(body,css=''){
 return zipSync({
  'META-INF/container.xml':strToU8('<container><rootfile full-path="OPS/book.opf"/></container>'),
  'OPS/book.opf':strToU8('<package><manifest><item id="c" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>'),
  'OPS/chapter.xhtml':strToU8(`<html xmlns:epub="http://www.idpf.org/2007/ops"><head><link rel="stylesheet" href="safe.css"/></head><body>${body}</body></html>`),
  'OPS/safe.css':strToU8(css),
 });
}
test('QA nested FB2 roles retain specific child role and exact note destinations',async()=>{
 const b=await parse('<section id="chapter"><epigraph><cite><p>Цитата <a href="#note">1</a></p><text-author>Имя</text-author></cite></epigraph></section><section id="note"><p>Примечание</p></section>');
 assert.deepEqual(b.blocks.map(x=>[x.text,x.presentation.role,x.sourceId]),[['Цитата 1','quote','chapter'],['Имя','attribution',null],['Примечание',undefined,'note']]);
 assert.match(b.blocks[0].html,/data-note="note"/);
});
test('QA EPUB namespaced roles inherit source alignment while prose obeys saved user alignment',async()=>{
 const b=await importBook(epub('<div style="text-align:right"><p>Проза</p><div epub:type="z3998:epigraph"><p>Эпиграф</p><p class="signature">Подпись</p></div></div>'),'qa.epub');
 assert.equal(b.blocks[0].presentation.align,undefined);
 assert.deepEqual(b.blocks.slice(1).map(x=>[x.presentation.role,x.presentation.align]),[['epigraph','right'],['attribution','right']]);
});
test('QA source CSS and executable SVG/script cannot enter book markup or source text',async()=>{
 const b=await importBook(epub('<p id="p" onclick="alert(1)">До <span class="accent">курсива</span><svg><script>EVIL_SVG</script><text>EVIL_TEXT</text></svg><script>EVIL_SCRIPT</script> после</p>', '.accent {font-style:italic;font-size:999px;font-family:evil;line-height:0;color:red;background:url(https://evil.test)}'),'qa.epub');
 assert.equal(b.blocks[0].text,'До курсива после');
 assert.match(b.blocks[0].html,/book-italic/);
 assert.doesNotMatch(JSON.stringify(b.blocks),/EVIL_|onclick|<svg|<script|https:|999px|font-family|background/);
});
test('QA plaintext retains source whitespace and escaped XML-looking content through upgrade',async()=>{
 const original=strToU8('  A & <script>literal</script>\r\nline\n\n  Б  ').buffer;
 const b=await importBook(original,'qa.txt');
 Object.assign(b,{id:'txt',original,fileName:'qa.txt',presentationVersion:undefined,progress:{anchor:{block:0,offset:10},annotations:[{start:{block:0,offset:2},end:{block:0,offset:12},text:'A & <scrip'}]},appearanceSettings:{align:'justify',fontSize:31}});
 const before=structuredClone(b);let saved;
 assert.equal(await upgradeBookPresentation(b,{saveBook:async value=>{saved=structuredClone(value);}}),true);
 assert.deepEqual(b.progress,before.progress);assert.deepEqual(saved.appearanceSettings,before.appearanceSettings);
 assert.deepEqual(b.blocks.map(x=>x.text),['  A & <script>literal</script>\nline','  Б  ']);
 assert.doesNotMatch(b.blocks[0].html,/<script>/);
});
test('QA incompatible legacy preformatted coordinates are retained and migration is attempted once',async()=>{
 const original=strToU8('<FictionBook><body><pre>A  B\n C</pre></body></FictionBook>').buffer;
 const blocks=[{id:'legacy',type:'p',text:'A B C',html:'A B C',sourceId:null}];
 const b={id:'legacy',original,fileName:'qa.fb2',blocks,progress:{anchor:{block:0,offset:4},annotations:[{start:{block:0,offset:2},end:{block:0,offset:5}}]}};
 const before=structuredClone(b);let writes=0;
 assert.equal(await upgradeBookPresentation(b,{saveBook:async()=>writes++}),false);
 assert.strictEqual(b.blocks,blocks);assert.deepEqual(b.progress,before.progress);
 assert.equal(await upgradeBookPresentation(b,{saveBook:async()=>writes++}),false);assert.equal(writes,1);
});
test('QA in-flight remote state remains on live book when presentation save resolves',async()=>{
 const original=strToU8('<FictionBook><body><epigraph><p>Текст</p></epigraph></body></FictionBook>').buffer;
 const b={id:'race',original,fileName:'qa.fb2',blocks:[{id:'b0',type:'p',text:'Текст',html:'Текст',sourceId:null}],progress:{anchor:{block:0,offset:0}},appearanceSettings:{align:'left'}};
 const remote={anchor:{block:0,offset:3},updatedAt:999};
 assert.equal(await upgradeBookPresentation(b,{saveBook:async()=>{b.progress=remote;b.appearanceSettings={align:'justify'};}}),true);
 assert.strictEqual(b.progress,remote);assert.equal(b.appearanceSettings.align,'justify');
});

test('QA legal CSS prelude must not suppress the first safe local style rule',async()=>{
 for(const prelude of ['@charset "UTF-8";','@import url(https://evil.test/style.css);']){
  const b=await importBook(epub('<p>До <span class="accent">курсива</span></p>',`${prelude} .accent {font-style:italic}`),'qa.epub');
  assert.match(b.blocks[0].html,/book-italic/,prelude);
  assert.doesNotMatch(JSON.stringify(b.blocks),/https:\/\/evil/);
 }
});
test('QA print-only and unsupported conditional CSS cannot become unconditional reader styles',async()=>{
 for(const css of ['@media print { .accent {font-style:italic} }','@supports (unsupported: bad) { .accent {font-weight:bold} }']){
  const b=await importBook(epub('<p>До <span class="accent">акцента</span></p>',css),'qa.epub');
  assert.doesNotMatch(b.blocks[0].html,/book-italic|book-bold/,css);
 }
});
