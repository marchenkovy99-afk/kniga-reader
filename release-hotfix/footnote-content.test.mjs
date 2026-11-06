import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {IDBFactory} from 'fake-indexeddb';
import {readFootnote as read} from './footnote-content.js';
const html=s=>new JSDOM('<!doctype html><body>'+s+'</body>').window.document;
const options={label:'[16]',targetIds:new Set(['n16','n17','n18'])};
const long='Полный текст длинного примечания, без сокращений. '.repeat(240).trim();
const cases=[
 ['empty anchor inside numbered heading', '<h3><a id="n16"></a>16</h3><p>От Рождества Христова (лат.).</p><h3><a id="n17"></a>17</h3><p>ЧУЖАЯ СНОСКА</p>','От Рождества Христова (лат.).'],
 ['number inside anchor followed by multiple paragraphs', '<p><a id="n16">[16]</a></p><p>Первый абзац.</p><p>Второй <em>важный</em> абзац.</p><p id="n17">17</p><p>ЧУЖАЯ СНОСКА</p>','Первый абзац.\n\nВторой важный абзац.'],
 ['anchor inside paragraph resolves full paragraph', '<p><a id="n16">16</a> Связанный текст.</p><p id="n17"><a>17</a>ЧУЖАЯ СНОСКА</p>','Связанный текст.'],
 ['explicit semantic aside retains all paragraphs', '<aside id="n16" epub:type="footnote"><h3>16</h3><p>Первый.</p><p>Последний.</p></aside><aside id="n17"><p>ЧУЖАЯ СНОСКА</p></aside>','Первый.\n\nПоследний.'],
 ['number-only target is not a successful footnote', '<p id="n16">16</p>',null],
 ['long note is never truncated', '<h3><a id="n16"></a>16</h3><p>'+long+'</p><h3 id="n17">17</h3><p>ЧУЖАЯ СНОСКА</p>',long],
 ['named anchor', '<p><a name="n16">16</a></p><p>Именованный якорь.</p><p><a name="n17">17</a></p><p>ЧУЖАЯ СНОСКА</p>','Именованный якорь.'],
 ['line breaks and safe literal markup', '<aside id="n16"><p>Первая строка.<br/>Вторая &lt;img onerror=alert(1)&gt;.</p></aside>','Первая строка.\nВторая <img onerror=alert(1)>.'],
 ['missing target', '<p id="n17">Другое примечание</p>',null]
];
for(const [name,markup,expected] of cases)test(name,()=>assert.equal(read(html(markup),'n16',options),expected));
test('FB2 anchor on title resolves the whole corresponding section only',()=>{
 const doc=new JSDOM('<FictionBook><body name="notes"><section><title><p id="n16">16</p></title><p>Первый абзац.</p><p>Последний абзац.</p></section><section id="n17"><title><p>17</p></title><p>ЧУЖАЯ СНОСКА</p></section></body></FictionBook>',{contentType:'application/xml'}).window.document;
 assert.equal(read(doc,'n16',options),'Первый абзац.\n\nПоследний абзац.');
});

test('FB2 click reads the original local file and renders the exact complete note',async()=>{
 const dom=new JSDOM('<div class="reading-root" data-book-id="test"><a data-note="n16">[16]</a></div>',{url:'https://reader.test/',runScripts:'outside-only'});
 const {window}=dom;
 const observers=[],NativeObserver=window.MutationObserver;
 window.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this)}};
 window.indexedDB=new IDBFactory();window.Blob=Blob;window.TextDecoder=TextDecoder;window.readFootnote=read;
 const expected='От Рождества Христова (лат.).\n\n'+long+'\n\nКонец примечания 16.';
 const xml='<FictionBook><body name="notes"><section><title><p id="n16">16</p></title>'+expected.split('\n\n').map(p=>'<p>'+p+'</p>').join('')+'</section><section id="n17"><p>ЧУЖАЯ СНОСКА</p></section></body></FictionBook>';
 const db=await new Promise((resolve,reject)=>{const r=window.indexedDB.open('libra-library',1);r.onupgradeneeded=()=>r.result.createObjectStore('books',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 await new Promise((resolve,reject)=>{const tx=db.transaction('books','readwrite');tx.objectStore('books').put({id:'test',format:'fb2',file:new Blob([xml])});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
 const source=await readFile(new URL('output/src/footnotes.js',import.meta.url),'utf8');
 window.eval(source.replace("import {readFootnote} from './footnote-content.js';",''));
 window.document.querySelector('a').click();
 for(let attempt=0;attempt<100&&window.document.querySelector('.libra-note-text')?.textContent==='Открываем сноску…';attempt++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(window.document.querySelector('.libra-note-text').textContent,expected);
 assert.equal(window.document.querySelector('.reading-root').dataset.bookId,'test');
 window.document.querySelector('.libra-note-card button').click();
 assert.equal(window.document.querySelector('.libra-note-card'),null);
 for(const observer of observers)observer.disconnect();dom.window.close();
});
