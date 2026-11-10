import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await pause(10);}throw Error('Timed out');}
async function fixture(api,epub=false){
 const dom=new JSDOM(`<div class="reading-root"><div class="reading-content"><div class="${epub?'epub-mount':'page-viewport'}"></div></div><div class="reading-tools"></div><div class="reading-title">Тест</div></div>`,{url:'https://fixture.test',pretendToBeVisual:true});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,MutationObserver:dom.window.MutationObserver,requestAnimationFrame:cb=>setTimeout(cb,0)});
 const root=document.querySelector('.reading-root');root.querySelector('.page-viewport,.epub-mount')[epub?'libraEpubPreview':'libraFb2Preview']=api;
 const {installBookSearch}=await import('../src/book-search.js');const dispose=installBookSearch(root);root.querySelector('.book-search-launch').click();
 return {root,dom,dispose,query(text){const input=root.querySelector('input');input.value=text;input.dispatchEvent(new dom.window.Event('input'));}};
}
test('search indexes FB2 table cells and renders HTML-looking text literally',async()=>{
 const f=await fixture({state:()=>({}),position:()=>({chapter:0,page:0}),chapters:()=>[{title:'Таблица',blocks:[{kind:'table',rows:[['РедкоеСлово <img src=x>','Вторая ячейка']]}]}]});
 try{f.query('редкоеслово');await until(()=>f.root.querySelector('.book-search-count').textContent!=='Ищем по книге…'&&f.root.querySelector('.book-search-count').textContent!=='');assert.equal(f.root.querySelectorAll('.book-search-result').length,1);assert.equal(f.root.querySelectorAll('.book-search-result img').length,0);}finally{f.dispose();f.dom.window.close();}
});
test('closing an EPUB search cancels further chapter loads',async()=>{
 let resolve,calls=0;const pending=new Promise(r=>resolve=r);const api={position:()=>({cfi:'start'}),state:()=>({book:{ready:Promise.resolve(),spine:{spineItems:[0,1,2].map(index=>({index,url:String(index),cfiFromRange:()=> 'cfi'})),hooks:{content:{trigger:async()=>{}}}},load:()=>{calls++;return pending;}}})};
 const f=await fixture(api,true);
 try{f.query('слово');await until(()=>calls===1);f.root.querySelector('[aria-label="Закрыть поиск"]').click();resolve(new f.dom.window.DOMParser().parseFromString('<html><body><p>слово</p></body></html>','text/html'));await pause(80);assert.equal(calls,1);}finally{f.dispose();f.dom.window.close();}
});

test('editing the query immediately removes stale results before debounce',async()=>{
 const f=await fixture({state:()=>({}),position:()=>({chapter:0,page:0}),chapters:()=>[{blocks:[{text:'Первое слово и второе слово'}]}]});
 try{f.query('первое');await until(()=>f.root.querySelector('.book-search-result'));f.query('второе');assert.equal(f.root.querySelectorAll('.book-search-result:not(:disabled)').length,0,'old matches must not remain clickable');await until(()=>f.root.querySelector('.book-search-result mark')?.textContent==='второе');}finally{f.dispose();f.dom.window.close();}
});

test('EPUB matches in a non-linear but readable spine section are searchable',async()=>{
 let doc;const section={index:1,url:'notes',linear:'no',cfiFromRange:()=> 'notes-hit'};
 const f=await fixture({position:()=>({cfi:'origin'}),state:()=>({book:{ready:Promise.resolve(),spine:{spineItems:[section],hooks:{content:{trigger:async()=>{}}}},load:async()=>doc}})},true);
 doc=new f.dom.window.DOMParser().parseFromString('<html><body><p>Редкая заметка</p></body></html>','text/html');
 try{f.query('редкая');await until(()=>f.root.querySelector('.book-search-count')?.textContent==='Ничего не найдено'||f.root.querySelector('.book-search-result'));assert.equal(f.root.querySelectorAll('.book-search-result').length,1);}finally{f.dispose();f.dom.window.close();}
});

test('search waits for FB2 chapter parsing instead of caching an empty index',async()=>{
 let loaded=false;const f=await fixture({state:()=>({}),position:()=>({chapter:0,page:0}),chapters:()=>loaded?[{blocks:[{text:'Искомое слово'}]}]:[]});
 try{f.query('слово');await pause(240);assert.notEqual(f.root.querySelector('.book-search-count')?.textContent,'Ничего не найдено');loaded=true;await until(()=>f.root.querySelector('.book-search-result'));assert.equal(f.root.querySelectorAll('.book-search-result').length,1);}finally{f.dispose();f.dom.window.close();}
});

test('EPUB search excludes CSS-hidden text but retains visible descendants and original CFI nodes',async()=>{
 let doc;const section={index:0,url:'chapter',cfiFromRange:()=> 'hit'};
 const f=await fixture({position:()=>({cfi:'origin'}),state:()=>({book:{ready:Promise.resolve(),spine:{spineItems:[section],hooks:{content:{trigger:async()=>{}}}},load:async()=>doc}})},true);
 doc=new f.dom.window.DOMParser().parseFromString('<html><head><style>.concealed{display:none}</style></head><body><p style="display:none">ТайнаяМетка</p><p class="concealed">ТайнаяМетка</p><p style="visibility:hidden">ТайнаяМетка <span style="visibility:visible">ВидимаяМетка</span></p></body></html>','text/html');
 const original=doc.documentElement.outerHTML;
 try{f.query('ТайнаяМетка');await until(()=>f.root.querySelector('.book-search-count')?.textContent==='Ничего не найдено'||f.root.querySelector('.book-search-result'));assert.equal(f.root.querySelectorAll('.book-search-result').length,0);f.query('ВидимаяМетка');await until(()=>f.root.querySelector('.book-search-result'));assert.equal(f.root.querySelectorAll('.book-search-result').length,1);assert.equal(doc.documentElement.outerHTML,original,'indexing must not change source nodes used by CFI');}finally{f.dispose();f.dom.window.close();}
});
