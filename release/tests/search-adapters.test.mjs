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
