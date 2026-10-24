import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPaginationCache} from '../reader/src/pagination-cache.js';
import {defaults} from '../reader/src/anchors.js';

const pages=[{html:'<div>Пример текста</div>',start:{block:0,offset:0},end:{block:0,offset:13}}];
const input=(settings={})=>({bookId:'a'.repeat(64),width:390,height:780,settings:{...defaults,...settings},environment:'test-browser',blocks:[{text:'Пример текста',html:'Пример текста'}]});
function disk(){
 const data=new Map();
 return {getPreference:async key=>structuredClone(data.get(key)),setPreference:async(key,value)=>{data.set(key,structuredClone(value));},deletePreference:async key=>{data.delete(key);}};
}
test('restarting the app opens saved pages without invoking pagination or its loading indicator',async()=>{
 const storage=disk();let calculations=0;
 const paginate=async()=>{calculations++;return structuredClone(pages);};
 await createPaginationCache({storage,paginate}).load(input());
 let misses=0;
 const reopened=await createPaginationCache({storage,paginate}).load({...input(),onMiss:()=>misses++});
 assert.deepEqual(reopened,pages);assert.equal(calculations,1);assert.equal(misses,0);
});
test('theme, page animation and object property order do not invalidate saved page geometry',async()=>{
 const storage=disk();let calculations=0;const paginate=async()=>{calculations++;return structuredClone(pages);};
 await createPaginationCache({storage,paginate}).load(input());
 const changed=input({theme:'oled',animation:false});changed.settings=Object.fromEntries(Object.entries(changed.settings).reverse());
 await createPaginationCache({storage,paginate}).load(changed);
 assert.equal(calculations,1);
});
test('typography, viewport, browser and source changes each require new pagination',async()=>{
 for(const change of [
  {settings:{...defaults,fontSize:30}},{settings:{...defaults,font:'sans'}},{settings:{...defaults,lineHeight:2}},
  {settings:{...defaults,margin:40}},{settings:{...defaults,hyphens:false}},{settings:{...defaults,align:'justify'}},
  {settings:{...defaults,indent:2}},{settings:{...defaults,letterSpacing:1}},{settings:{...defaults,paragraphGap:1}},
  {width:780,height:390},{environment:'different-browser'},
  {blocks:[{text:'Новая редакция',html:'Новая редакция'}]},
 ]){
  const storage=disk();let calculations=0;const paginate=async()=>{calculations++;return structuredClone(pages);};
  await createPaginationCache({storage,paginate}).load(input());
  await createPaginationCache({storage,paginate}).load({...input(),...change});
  assert.equal(calculations,2,JSON.stringify(change));
 }
});
test('keeps recent layouts across rotation and evicts only the oldest variant',async()=>{
 const storage=disk();let calculations=0;const paginate=async()=>{calculations++;return structuredClone(pages);};
 for(const width of [390,780,400,420])await createPaginationCache({storage,paginate}).load({...input(),width});
 await createPaginationCache({storage,paginate}).load({...input(),width:780});
 assert.equal(calculations,4);
 await createPaginationCache({storage,paginate}).load(input());
 assert.equal(calculations,5);
});
test('storage failure and corrupt caches fall back to calculation without losing the book',async()=>{
 let calculations=0,errors=0;
 const paginate=async()=>{calculations++;return structuredClone(pages);};
 const failed={getPreference:async()=>{throw Error('unavailable');},setPreference:async()=>{throw Error('quota');}};
 assert.deepEqual(await createPaginationCache({storage:failed,paginate,onStorageError:()=>errors++}).load(input()),pages);
 assert.equal(calculations,1);assert.ok(errors>0);
 const storage=disk();await createPaginationCache({storage,paginate}).load(input());
 const original=storage.getPreference;storage.getPreference=async key=>{const record=await original(key);if(record?.entries)record.entries[0].pages=[];return record;};
 assert.deepEqual(await createPaginationCache({storage,paginate}).load(input()),pages);
 assert.equal(calculations,3);
});
test('aborted calculations never become a saved layout',async()=>{
 const storage=disk(),controller=new AbortController();let calculations=0;
 const cache=createPaginationCache({storage,paginate:async()=>{controller.abort();return pages;}});
 await assert.rejects(cache.load({...input(),signal:controller.signal}),{name:'AbortError'});
 await createPaginationCache({storage,paginate:async()=>{calculations++;return pages;}}).load(input());
 assert.equal(calculations,1);
});
test('removing a book clears its memory and persistent pagination cache',async()=>{
 const storage=disk();let calculations=0;const paginate=async()=>{calculations++;return structuredClone(pages);};
 const cache=createPaginationCache({storage,paginate});await cache.load(input());
 await cache.remove(input().bookId);await cache.load(input());
 assert.equal(calculations,2);
 await cache.remove(input().bookId);
 await createPaginationCache({storage,paginate}).load(input());assert.equal(calculations,3);
});
test('truncated, unordered or blank cached pages cannot hide part of the book',async()=>{
 const complete=[
  {html:'<div>Пример</div>',start:{block:0,offset:0},end:{block:0,offset:6}},
  {html:'<div> текста</div>',start:{block:0,offset:6},end:{block:0,offset:13}},
 ];
 for(const corrupt of [p=>p.pop(),p=>p.shift(),p=>p.reverse(),p=>{p[0].end.offset=4;},p=>{p[0].html='';}]){
  const storage=disk();let calculations=0;
  const paginate=async()=>{calculations++;return structuredClone(complete);};
  await createPaginationCache({storage,paginate}).load(input());
  const read=storage.getPreference;storage.getPreference=async key=>{const record=await read(key);if(record?.entries)corrupt(record.entries[0].pages);return record;};
  assert.deepEqual(await createPaginationCache({storage,paginate}).load(input()),complete);
  assert.equal(calculations,2);
 }
});
