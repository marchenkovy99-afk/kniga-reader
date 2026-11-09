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
