import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

for(const action of ['close','return'])test(action==='close'?'closing an overlay preserves the selected CFI without another navigation':'only Return restores the pre-search origin',async()=>{
 const dom=new JSDOM('<div class="reading-root"><div class="reading-content"><div class="epub-mount"></div></div><nav class="reading-tools"></nav><div class="reading-title">Книга</div></div>',{url:'https://fixture.test',pretendToBeVisual:true});
 const w=dom.window,root=w.document.querySelector('.reading-root');Object.assign(globalThis,{window:w,document:w.document,MutationObserver:w.MutationObserver,requestAnimationFrame:cb=>setTimeout(cb,0)});
 const doc=new w.DOMParser().parseFromString('<html><body><p>Найденное слово</p></body></html>','text/html');
 const range=doc.createRange();range.selectNodeContents(doc.querySelector('p'));range.getClientRects=()=>[{left:20,top:30,right:70,bottom:50,width:50,height:20}];root.getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:844,width:390,height:844});root.querySelector('.epub-mount').getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:844,width:390,height:844});
 let position={chapter:0,page:0,cfi:'origin'};const navigated=[];
 const api={position:()=>({...position}),navigate:async cfi=>{navigated.push(cfi);position={chapter:1,page:6,cfi};},state:()=>({book:{ready:Promise.resolve(),spine:{spineItems:[{index:1,url:'chapter',cfiFromRange:()=> 'found'}],hooks:{content:{trigger:async()=>{}}}},load:async()=>doc},rendition:{getRange:()=>range}})};
 root.querySelector('.epub-mount').libraEpubPreview=api;
 const {installBookSearch}=await import('../src/book-search.js');const dispose=installBookSearch(root);
 const wait=async fn=>{for(let i=0;i<120;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('timeout');};
 try{
  root.querySelector('.book-search-launch').click();const input=root.querySelector('input');input.value='слово';input.dispatchEvent(new w.Event('input'));
  await wait(()=>root.querySelector('.book-search-result'));root.querySelector('.book-search-result').click();await wait(()=>root.querySelector('.book-search-nav output')?.textContent==='1 / 1');
  root.querySelector(action==='close'?'[aria-label="Завершить поиск"]':'[aria-label="Вернуться к исходному месту"]').click();await wait(()=>!root.querySelector('.book-search-nav'));await new Promise(r=>setTimeout(r,40));
  const target=action==='close'?'found':'origin';assert.deepEqual(navigated,action==='close'?['found']:['found',target]);assert.equal(position.cfi,target);
 }finally{dispose();dom.window.close();}
});
