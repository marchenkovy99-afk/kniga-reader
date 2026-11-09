import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

// Boundary fixture for the renderer's asynchronous resize/relocation queue.
// Actual FB2/EPUB rendering is exercised by the browser suite.
async function fixture(){
 const dom=new JSDOM('<div class="reading-root"><div class="reading-content"><div class="epub-mount"></div></div><nav class="reading-tools"></nav><div class="reading-title">Книга</div><div class="reading-zones"></div></div>',{url:'https://fixture.test',pretendToBeVisual:true});
 const w=dom.window,root=w.document.querySelector('.reading-root');Object.assign(globalThis,{window:w,document:w.document,MutationObserver:w.MutationObserver,requestAnimationFrame:cb=>setTimeout(cb,0)});
 const doc=new w.DOMParser().parseFromString('<html><body><p>Искомое слово</p></body></html>','text/html');
 let activeRange=null;let ready=true,position={chapter:0,page:0,cfi:'origin'};const visited=[];
 const range=doc.createRange();range.selectNodeContents(doc.querySelector('p'));range.getClientRects=()=>[{left:20,top:30,right:70,bottom:50,width:50,height:20}];
 activeRange=range;root.getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:844,width:390,height:844});root.querySelector('.epub-mount').getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:844,width:390,height:844});
 const api={position:()=>({...position}),settled:()=>ready,navigate:async cfi=>{visited.push(cfi);position={chapter:1,page:6,cfi};},state:()=>({book:{ready:Promise.resolve(),spine:{spineItems:[{index:1,url:'chapter',cfiFromRange:()=> 'found'}],hooks:{content:{trigger:async()=>{}}}},load:async()=>doc},rendition:{getRange:()=>activeRange}})};
 root.querySelector('.epub-mount').libraEpubPreview=api;
 const {installBookSearch}=await import('../src/book-search.js');const dispose=installBookSearch(root);
 const wait=async fn=>{for(let i=0;i<160;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('timeout');};
 async function select(){root.querySelector('.book-search-launch').click();const input=root.querySelector('input');input.value='слово';input.dispatchEvent(new w.Event('input'));await wait(()=>root.querySelector('.book-search-result'));root.querySelector('.book-search-result').click();}
 return {dom,root,visited,wait,select,ready:value=>ready=value,position:value=>position=value,range:value=>activeRange=value,dispose(){dispose();dom.window.close();}};
}

test('navigation waits for pending renderer resize before displaying a match',async()=>{
 const f=await fixture();try{f.ready(false);await f.select();await new Promise(r=>setTimeout(r,40));assert.deepEqual(f.visited,[],'display must wait for renderer readiness');f.ready(true);await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');assert.deepEqual(f.visited,['found']);}finally{f.dispose();}
});

test('closing search after automatic repagination preserves selected CFI',async()=>{
 const f=await fixture();try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');f.position({chapter:1,page:5,cfi:'page-start-after-resize'});f.root.querySelector('[aria-label="Завершить поиск"]').click();await f.wait(()=>f.visited.length>=2);assert.equal(f.visited.at(-1),'found');}finally{f.dispose();}
});

test('closing search after manual reading keeps the manually selected place',async()=>{
 const f=await fixture();try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');f.root.querySelector('.reading-zones').dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true}));f.position({chapter:1,page:7,cfi:'manual-page'});f.root.querySelector('[aria-label="Завершить поиск"]').click();await f.wait(()=>f.visited.length>=2);assert.equal(f.visited.at(-1),'manual-page');}finally{f.dispose();}
});

test('a viewport resize keeps the selected result until the reader navigates manually',async()=>{
 const f=await fixture();try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');f.position({chapter:0,page:0,cfi:'old-resize-target'});f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await f.wait(()=>f.visited.length>=2);assert.equal(f.visited.at(-1),'found');}finally{f.dispose();}
});

test('idle resize never opens search when the renderer cannot settle',async t=>{
 const f=await fixture();try{f.ready(false);let time=0;t.mock.method(performance,'now',()=>time+=13000);f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await new Promise(r=>setTimeout(r,30));assert.equal(f.root.querySelector('.book-search-panel'),null);}finally{t.mock.restoreAll();f.dispose();}
});

test('Close waits for a pending manual EPUB turn before capturing its position',async()=>{
 const f=await fixture();try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');f.root.querySelector('.reading-zones').dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true,clientX:380}));f.ready(false);f.root.querySelector('[aria-label="Завершить поиск"]').click();setTimeout(()=>{f.position({chapter:1,page:7,cfi:'manual-after-queue'});f.ready(true);},40);await f.wait(()=>f.visited.length>=2);assert.equal(f.visited.at(-1),'manual-after-queue');}finally{f.dispose();}
});

test('a center tap does not discard the chosen match anchor during resize',async()=>{
 const f=await fixture();try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');f.root.querySelector('.reading-zones').dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true,clientX:195}));f.position({chapter:1,page:5,cfi:'automatic-reflow'});f.root.querySelector('[aria-label="Завершить поиск"]').click();await f.wait(()=>f.visited.length>=2);assert.equal(f.visited.at(-1),'found');}finally{f.dispose();}
});

test('a missing live text range is an error rather than successful navigation',async t=>{t.mock.method(console,'error',()=>{});
 const f=await fixture();try{f.range(null);await f.select();await new Promise(r=>setTimeout(r,60));assert.ok(f.root.querySelector('.book-search-panel'),'failed navigation must offer retry');assert.notEqual(f.root.querySelector('.book-search-nav output')?.textContent,'1 / 1');}finally{f.dispose();}
});

test('search cannot reopen while Close is still restoring the reading layout',async()=>{
 const f=await fixture();try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');f.ready(false);f.root.querySelector('[aria-label="Завершить поиск"]').click();const launch=f.root.querySelector('.book-search-launch');assert.equal(launch.disabled,true);launch.click();assert.equal(f.root.querySelector('.book-search-panel'),null);f.ready(true);await f.wait(()=>!launch.disabled);assert.equal(f.visited.at(-1),'found');}finally{f.dispose();}
});
