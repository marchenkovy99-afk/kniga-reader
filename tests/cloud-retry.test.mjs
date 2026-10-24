import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const original=readFileSync(new URL('../reader/src/cloud.js',import.meta.url),'utf8');
function harness({preferences={},session={},api=null}={}){
 const prefs=new Map(Object.entries(preferences)),tabs=new Map(Object.entries(session)),timers=new Map();
 let timerIndex=0,fetchCount=0,uploads=[];
 const storage={
   getPreference:async key=>prefs.get(key),
   setPreference:async(key,value)=>{prefs.set(key,structuredClone(value));},
   deletePreference:async key=>{prefs.delete(key);},
   listPreferenceKeys:async prefix=>[...prefs.keys()].filter(key=>key.startsWith(prefix)),
   putBook:async()=>{}
 };
 const transport={
  api:async (url,opts={})=>{
   if(api)return api(url,opts);
   if(url==='/api/cloud'){fetchCount++;return Response.json({userId:'owner-1',displayName:'reader@example.test',books:[],states:[]});}
   uploads.push(JSON.parse(opts.body));return Response.json({saved:true});
  }
 };
 const context={crypto:globalThis.crypto,Response,storage,sessionStorage:{getItem:k=>tabs.get(k)||null,setItem:(k,v)=>tabs.set(k,v)},
   supabaseTransport:transport,
   mergeMarks:(...groups)=>groups.flat(),mergeAnnotations:(...groups)=>groups.flat(),
   newestState:(rows,key)=>rows.filter(x=>x.key===key).sort((a,b)=>b.clientUpdatedAt-a.clientUpdatedAt)[0],
   sha256:()=>'',importBook:async()=>{},
   setTimeout:(fn)=>{const id=++timerIndex;timers.set(id,fn);return id;},
   clearTimeout:id=>timers.delete(id)};
 let code=original.replace(/^import .*?;\s*$/gm,'')
   .replaceAll("import.meta.env.MODE==='pages'","true")
   .replace('export class CloudSync','class CloudSync');
 code+='\nglobalThis.ReaderCloud=CloudSync;';
 vm.runInNewContext(code,context);
 const cloud=new context.ReaderCloud({books:()=>[],status:()=>{}});
 return {cloud,prefs,tabs,timers,uploads,get fetchCount(){return fetchCount;},async flush(){const all=[...timers.values()];timers.clear();for(const fn of all)await fn();await new Promise(setImmediate);}};
}
test('offline position survives reader restart and old session queue is recovered',async()=>{
 const key='position:'+'a'.repeat(64);
 const h=harness({preferences:{
  'cloud-owner':'owner-1',
  'cloud-pending:owner-1:old-tab':{[key]:{key,payload:{anchor:{block:1,offset:2}},clientUpdatedAt:50}}
 },session:{'kniga-device':'new-tab'}});
 await h.cloud.init();
 assert.equal(h.cloud.deviceId,'new-tab');
 assert.equal(h.prefs.get('kniga-installation-id'),'new-tab');
 assert.equal(h.prefs.has('cloud-pending:owner-1:old-tab'),false);
 assert.equal(h.uploads.length,1);
 assert.equal(h.uploads[0].deviceId,'new-tab');
 assert.equal(h.cloud.status,'Синхронизировано');
 const second=harness({preferences:Object.fromEntries(h.prefs)});
 await second.cloud.init();
 assert.equal(second.cloud.deviceId,'new-tab');
});
test('a second sync request while one is running triggers another network fetch',async()=>{
 let resolveFirst;let calls=0;
 const h=harness({api:async(url)=>{if(url!=='/api/cloud')throw Error('unexpected write');calls++;if(calls===1)return new Promise(resolve=>{resolveFirst=resolve;});return Response.json({userId:'owner-1',displayName:'reader@example.test',books:[],states:[]});}});
 h.cloud.deviceId='device-1';h.cloud.owner='owner-1';
 const first=h.cloud.sync();
 await h.cloud.sync();
 resolveFirst(Response.json({userId:'owner-1',displayName:'reader@example.test',books:[],states:[]}));
 await first;
 await h.flush();
 assert.equal(calls,2);
 assert.equal(h.cloud.status,'Синхронизировано');
});
