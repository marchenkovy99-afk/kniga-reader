import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

// Boundary fixture for the renderer's asynchronous resize/relocation queue.
// Actual FB2/EPUB rendering is exercised by the browser suite.
async function fixture({collapsedOrigin=false}={}){
 const dom=new JSDOM('<div class="reading-root"><div class="reading-content"><div class="epub-mount"></div></div><nav class="reading-tools"></nav><div class="reading-title">Книга</div><div class="reading-zones"></div></div>',{url:'https://fixture.test',pretendToBeVisual:true});
 const w=dom.window,root=w.document.querySelector('.reading-root');Object.assign(globalThis,{window:w,document:w.document,MutationObserver:w.MutationObserver,requestAnimationFrame:cb=>setTimeout(cb,0)});
 const doc=new w.DOMParser().parseFromString('<html><body><p>Искомое слово</p></body></html>','text/html');
 let activeRange=null;let ready=true,position={chapter:0,page:0,cfi:'origin'};const visited=[];
 const range=doc.createRange();range.selectNodeContents(doc.querySelector('p'));range.getClientRects=()=>[{left:20,top:30,right:70,bottom:50,width:50,height:20}];
 const originRange=doc.createRange();originRange.setStart(doc.querySelector('p').firstChild,2);originRange.collapse(true);
 const proto=Object.getPrototypeOf(originRange);proto.getClientRects=function(){return [{left:20,top:30,right:this.collapsed?20:70,bottom:50,width:this.collapsed?0:50,height:20}]};
 activeRange=range;root.getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:844,width:390,height:844});root.querySelector('.epub-mount').getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:844,width:390,height:844});
 let failReturn=true;const api={position:()=>({...position}),settled:()=>ready,navigate:async cfi=>{visited.push(cfi);if(cfi==='origin'&&failReturn){failReturn=false;throw Error('Controlled one-time navigation failure');}position={chapter:1,page:6,cfi};},state:()=>({book:{ready:Promise.resolve(),spine:{spineItems:[{index:1,url:'chapter',cfiFromRange:()=> 'found'}],hooks:{content:{trigger:async()=>{}}}},load:async()=>doc},rendition:{getRange:cfi=>collapsedOrigin&&cfi==='origin'?originRange:activeRange}})};
 root.querySelector('.epub-mount').libraEpubPreview=api;
 const {installBookSearch}=await import('../src/book-search.js');const dispose=installBookSearch(root);
 const wait=async fn=>{for(let i=0;i<160;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('timeout');};
 async function select(){root.querySelector('.book-search-launch').click();const input=root.querySelector('input');input.value='слово';input.dispatchEvent(new w.Event('input'));await wait(()=>root.querySelector('.book-search-result'));root.querySelector('.book-search-result').click();}
 return {dom,root,visited,wait,select,ready:value=>ready=value,current:()=>({...position}),position:value=>position=value,range:value=>activeRange=value,dispose(){dispose();dom.window.close();}};
}

test('failed Return preserves its original target and offers an immediate retry',async t=>{
 t.mock.method(console,'error',()=>{});const f=await fixture();try{await f.select();await f.wait(()=>f.root.querySelector('.book-search-nav output')?.textContent==='1 / 1');f.root.querySelector('[aria-label="Вернуться к исходному месту"]').click();await f.wait(()=>!f.root.querySelector('.book-search-launch').disabled);const retry=f.root.querySelector('[aria-label="Вернуться к исходному месту"]');assert.ok(retry,'failed return must retain its action and source');retry.click();await f.wait(()=>!f.root.querySelector('.book-search-nav')&&!f.root.querySelector('.book-search-launch').disabled);assert.equal(f.visited.at(-1),'origin');assert.equal(f.current().cfi,'origin');}finally{f.dispose();}
});
