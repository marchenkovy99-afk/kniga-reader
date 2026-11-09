import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {adapters} from '../scripts/search-adapters.mjs';
function fb2(){
 const pages=[],context=vm.createContext({element:{},i:[],Le:{},R:true,ie:false,g:null,x:0,O:{width:390,height:700},us:24,E:414,fe:{current:{}},ve:{current:{block:0,offset:0}},M:{current:99},Co:()=>7,be:p=>pages.push(p)});
 context.xe=async chapter=>{context.x=chapter;context.ve.current=undefined;};
 vm.runInContext(adapters[0][1]+'()=>({})}',context);
 return {api:context.element.libraFb2Preview,context,pages};
}
test('FB2 source anchor determines destination under current page geometry',async()=>{
 const {api,pages}=fb2();await api.seek({chapter:0,anchor:{block:4,textNode:0,offset:17}});assert.deepEqual(pages,[7]);
});
test('FB2 cross-chapter seek carries the source anchor into the new layout',async()=>{
 const {api,context}=fb2();await api.seek({chapter:1,anchor:{block:4,textNode:0,offset:17}});assert.equal(context.x,1);assert.equal(context.M.current,undefined);assert.equal(context.ve.current?.block,4);assert.equal(context.ve.current?.offset,17);
});

test('FB2 Return prefers its text anchor over an obsolete physical page',async()=>{
 const {api,context}=fb2();await api.seek({chapter:1,page:3,anchor:{block:4,textNode:0,offset:17}});assert.equal(context.M.current,undefined);
});
test('FB2 fallback can settle even when paginated readiness is false',()=>{
 const {api,context}=fb2();context.R=false;context.ie=true;context.g={type:'overflow'};assert.equal(api.settled(),true);
});

test('returning to the library waits for fresh persisted book positions',async()=>{
 const {libraryNavigationAdapters}=await import('../scripts/search-adapters.mjs');
 let finish,opened=false;const pending=new Promise(resolve=>finish=resolve),ctx=vm.createContext({m:()=>pending,a:()=>opened=true});
 vm.runInContext((libraryNavigationAdapters?.[0]?.[1]||'function b(){a(null),m()}')+';globalThis.back=b',ctx);
 const operation=ctx.back();assert.equal(opened,false,'stale library must not be exposed before progress reload');finish();await operation;assert.equal(opened,true);
});

test('EPUB persists the exact selected CFI rather than the physical page start',async()=>{
 let saved;const context=vm.createContext({element:{},f:{current:{chapter:1,page:3,cfi:'page-start'}},u:{current:'page-start'},e:{id:'book'},ue:async(id,position)=>saved={id,position},Date});
 vm.runInContext(adapters[1][1]+'()=>({})}',context);
 await context.element.libraEpubPreview.save({chapter:1,page:3,cfi:'exact-match-range'});
 assert.equal(saved.id,'book');assert.equal(saved.position.cfi,'exact-match-range');assert.equal(context.u.current,'exact-match-range');assert.equal(context.f.current.cfi,'exact-match-range');
});

test('EPUB startup relocation preserves the saved source CFI through first layout',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../src/assets/index-DMkgLOVA.js',import.meta.url),'utf8');const start=source.indexOf('F.current=t=>{let n=As(t)',500000),end=source.indexOf(',_e.current=',start);assert.ok(start>0&&end>start);
 const fn=source.slice(start+'F.current='.length,end);let saved;const ctx=vm.createContext({As:()=>({index:1,page:3,total:10,cfi:'page-start'}),c:{current:true},u:{current:'saved-range'},e:{id:'book',position:{cfi:'saved-range',fraction:.2}},g:false,re:()=>{},ae:()=>{},_s:()=>0,D:[],le:{current:true},P:{current:'layout'},he:{current:{key:'layout',values:{1:10}}},ne:{current:[{index:1}]},f:{current:{}},ue:async(id,position)=>saved=position,Date});
 vm.runInContext('globalThis.commit='+fn,ctx);ctx.commit({});assert.equal(ctx.u.current,'saved-range');assert.equal(saved.cfi,'saved-range');ctx.g=true;ctx.commit({});assert.equal(saved.cfi,'page-start','real later relocations must remain navigable');
});
