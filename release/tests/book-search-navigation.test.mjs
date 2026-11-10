import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

// Boundary fixture for the renderer's asynchronous resize/relocation queue.
// Actual FB2/EPUB rendering is exercised by the browser suite.
async function fixture({collapsedOrigin=false,bottomHit=false}={}){
 const dom=new JSDOM('<div class="reading-root"><div class="reading-content"><div class="epub-mount"></div></div><nav class="reading-tools"></nav><div class="reading-title">Книга</div><div class="reading-zones"></div></div>',{url:'https://fixture.test',pretendToBeVisual:true});
 const w=dom.window,root=w.document.querySelector('.reading-root');Object.assign(globalThis,{window:w,document:w.document,MutationObserver:w.MutationObserver,requestAnimationFrame:cb=>setTimeout(cb,0)});
 const doc=new w.DOMParser().parseFromString('<html><body><p>Искомое слово</p></body></html>','text/html');
 let activeRange=null;let ready=true,position={chapter:0,page:0,cfi:'origin'};const visited=[];
 const nativeBox=w.HTMLElement.prototype.getBoundingClientRect;w.HTMLElement.prototype.getBoundingClientRect=function(){if(this.classList.contains('book-search-nav')){const top=this.dataset.placement==='top'?8:740;return {left:12,right:378,top,bottom:top+96,width:366,height:96};}return nativeBox.call(this);};
 const range=doc.createRange();range.selectNodeContents(doc.querySelector('p'));range.getClientRects=()=>[{left:20,top:bottomHit?770:30,right:70,bottom:bottomHit?790:50,width:50,height:20}];
 const originRange=doc.createRange();originRange.setStart(doc.querySelector('p').firstChild,2);originRange.collapse(true);
 const proto=Object.getPrototypeOf(originRange);proto.getClientRects=function(){return [{left:20,top:30,right:this.collapsed?20:70,bottom:50,width:this.collapsed?0:50,height:20}]};
 activeRange=range;root.getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:844,width:390,height:844});root.querySelector('.epub-mount').getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:844,width:390,height:844});
 const api={position:()=>({...position}),settled:()=>ready,navigate:async cfi=>{visited.push(cfi);position={chapter:1,page:6,cfi};},state:()=>({book:{ready:Promise.resolve(),spine:{spineItems:[{index:1,url:'chapter',cfiFromRange:()=> 'found'}],hooks:{content:{trigger:async()=>{}}}},load:async()=>doc},rendition:{getRange:cfi=>collapsedOrigin&&cfi==='origin'?originRange:activeRange}})};
 root.querySelector('.epub-mount').libraEpubPreview=api;
 const {installBookSearch}=await import('../src/book-search.js');const dispose=installBookSearch(root);
 const wait=async fn=>{for(let i=0;i<160;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('timeout');};
 async function select(){root.querySelector('.book-search-launch').click();const input=root.querySelector('input');input.value='слово';input.dispatchEvent(new w.Event('input'));await wait(()=>root.querySelector('.book-search-result'));root.querySelector('.book-search-result').click();}
 return {dom,root,visited,wait,select,ready:value=>ready=value,current:()=>({...position}),position:value=>position=value,range:value=>activeRange=value,dispose(){dispose();dom.window.close();}};
}

test('navigation waits for pending renderer resize before displaying a match',async()=>{
 const f=await fixture();try{f.ready(false);await f.select();await new Promise(r=>setTimeout(r,40));assert.deepEqual(f.visited,[],'display must wait for renderer readiness');f.ready(true);await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');assert.deepEqual(f.visited,['found']);}finally{f.dispose();}
});

test('Close removes the overlay synchronously without navigating or changing the current place',async()=>{
 const f=await fixture();try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');const before=f.current();f.root.querySelector('[aria-label="Завершить поиск"]').click();assert.equal(f.root.querySelector('.book-search-nav'),null);assert.deepEqual(f.current(),before);await new Promise(r=>setTimeout(r,40));assert.deepEqual(f.visited,['found'],'Close must not redisplay the book');}finally{f.dispose();}
});

test('Close while a manual page is loading dismisses immediately and lets that turn finish',async()=>{
 const f=await fixture();try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');f.ready(false);f.root.querySelector('.reading-zones').dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true,clientX:380}));f.root.querySelector('[aria-label="Завершить поиск"]').click();assert.equal(f.root.querySelector('.book-search-nav'),null);f.position({chapter:1,page:7,cfi:'manual-page'});f.ready(true);await new Promise(r=>setTimeout(r,40));assert.equal(f.current().cfi,'manual-page');assert.deepEqual(f.visited,['found']);}finally{f.dispose();}
});

test('a viewport resize keeps the selected result until the reader navigates manually',async()=>{
 const f=await fixture();try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');f.position({chapter:0,page:0,cfi:'old-resize-target'});f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await f.wait(()=>f.visited.length>=2);assert.equal(f.visited.at(-1),'found');}finally{f.dispose();}
});

test('idle resize never opens search when the renderer cannot settle',async t=>{
 const f=await fixture();try{f.ready(false);let time=0;t.mock.method(performance,'now',()=>time+=13000);f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await new Promise(r=>setTimeout(r,30));assert.equal(f.root.querySelector('.book-search-panel'),null);}finally{t.mock.restoreAll();f.dispose();}
});

test('a missing live text range is an error rather than successful navigation',async t=>{t.mock.method(console,'error',()=>{});
 const f=await fixture();try{f.range(null);await f.select();await new Promise(r=>setTimeout(r,60));assert.ok(f.root.querySelector('.book-search-panel'),'failed navigation must offer retry');assert.notEqual(f.root.querySelector('.book-search-nav output')?.textContent,'1 / 1');}finally{f.dispose();}
});

test('Close can cancel a pending search navigation without painting stale highlights into a new session',async()=>{
 const f=await fixture();try{f.ready(false);await f.select();const close=f.root.querySelector('[aria-label="Завершить поиск"]');assert.equal(close.disabled,false,'Close must stay available while locating');close.click();assert.equal(f.root.querySelector('.book-search-nav'),null);const launch=f.root.querySelector('.book-search-launch');assert.equal(launch.disabled,false);launch.click();assert.ok(f.root.querySelector('.book-search-panel'));f.ready(true);await new Promise(r=>setTimeout(r,60));assert.equal(f.root.querySelector('[data-search-highlight]'),null);assert.deepEqual(f.visited,[]);}finally{f.dispose();}
});

 test('Return accepts a collapsed EPUB source CFI by checking its adjacent character',async t=>{t.mock.method(console,'error',()=>{});
 const f=await fixture({collapsedOrigin:true});try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');f.root.querySelector('[aria-label="Вернуться к исходному месту"]').click();await f.wait(()=>!f.root.querySelector('.book-search-launch').disabled);assert.equal(f.root.querySelector('.book-search-panel'),null,'a valid zero-width CFI must not produce a false navigation error');assert.equal(f.visited.at(-1),'origin');}finally{f.dispose();}
 });

test('a bottom-edge match moves the overlay to the top without navigating again',async()=>{
 const f=await fixture({bottomHit:true});try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');assert.equal(f.root.querySelector('.book-search-nav').dataset.placement,'top');assert.deepEqual(f.visited,['found']);assert.ok(f.root.querySelector('[data-search-highlight]'));}finally{f.dispose();}
});
