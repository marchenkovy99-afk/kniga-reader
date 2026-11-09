import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
const root=new URL('../src/',import.meta.url),source=readFileSync(new URL('sw.js',root),'utf8');
const urls=JSON.parse(source.match(/const PRECACHE_URLS = (.*);/)[1]),hashes=JSON.parse(source.match(/const PRECACHE_HASHES = (.*);/)[1]);
function worker({corrupt,offline=false}={}){
 const handlers=new Map(),stores=new Map();let isOffline=offline;
 const absolute=input=>typeof input==='string'?new URL(input,'https://fixture.test/').href:input.url;
 const caches={keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async name=>{if(!stores.has(name))stores.set(name,new Map());const values=stores.get(name);return {put:async(key,value)=>values.set(absolute(key),value.clone()),match:async(key,opts)=>{const url=absolute(key);if(opts?.ignoreSearch)return [...values].find(([k])=>k.split('?')[0]===url.split('?')[0])?.[1].clone();return values.get(url)?.clone()}}}};
 const context={self:{registration:{scope:'https://fixture.test/'},addEventListener:(name,fn)=>handlers.set(name,fn),clients:{matchAll:async()=>[],claim:async()=>{}}},caches,crypto:webcrypto,URL,Response,Headers,AbortController,Uint8Array,setTimeout,clearTimeout,fetch:async url=>{if(isOffline)throw Error('Offline');const path=new URL(url).pathname.slice(1);let bytes=readFileSync(new URL(path,root));if('/'+path===corrupt)bytes=Buffer.from('wrong build');return new Response(bytes)}};
 vm.runInNewContext(source,context);
 async function event(type,properties={}){let task,result;handlers.get(type)({...properties,waitUntil:p=>task=p,respondWith:p=>result=p});if(task)await task;return result?await result:undefined}
 return {event,caches,stores,setOffline:value=>isOffline=value};
}
test('all offline imports are pinned to the exact current release',()=>{for(const path of urls)assert.equal(createHash('sha256').update(readFileSync(new URL(path.slice(1),root))).digest('hex'),hashes[path],path);for(const path of ['page-turns.js','reading-time.js','adjacent-pages.js','epub-snapshot.js','book-search.js','book-search-core.js','book-search.css'])assert.ok(urls.includes('/'+path))});
test('a complete installation serves the reader and gesture module offline',async()=>{const w=worker();await w.event('install');await w.event('activate');w.setOffline(true);const shell=await w.event('fetch',{request:{method:'GET',url:'https://fixture.test/',mode:'navigate'}});assert.ok((await shell.text()).includes('reader-touch-fix.js'));const js=await w.event('fetch',{request:{method:'GET',url:'https://fixture.test/page-turns.js',mode:'cors'}});assert.equal(await js.text(),readFileSync(new URL('page-turns.js',root),'utf8'))});
test('a mixed release cannot be marked as completely cached',async()=>{const w=worker({corrupt:'/page-turns.js'});await assert.rejects(w.event('install'),/another release/);for(const cache of w.stores.values())assert.equal(cache.has('https://fixture.test/__libra_complete__'),false)});
test('offline readiness acknowledges every pinned file',async()=>{const w=worker();await w.event('install');let result;await w.event('message',{data:{type:'LIBRA_OFFLINE_STATUS'},ports:[{postMessage:r=>result=r}]});assert.equal(result.ready,true);assert.equal(result.files,urls.length);assert.equal(result.missing.length,0)});
