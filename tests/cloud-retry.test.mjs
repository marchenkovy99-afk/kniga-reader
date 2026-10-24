import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {pendingForAccount,bookAppearanceKey,latestBookAppearance,latestReadingSettings,resolveReadingAppearance} from '../reader/src/sync-model.js';

const original=readFileSync(new URL('../reader/src/cloud.js',import.meta.url),'utf8');
function harness({preferences={},session={},api=null,bookList=[],callbacks={}}={}){
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
 const context={pendingForAccount,bookAppearanceKey,latestBookAppearance,latestReadingSettings,crypto:globalThis.crypto,Response,storage,sessionStorage:{getItem:k=>tabs.get(k)||null,setItem:(k,v)=>tabs.set(k,v)},
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
 const cloud=new context.ReaderCloud({books:()=>bookList,status:()=>{},...callbacks});
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


test('two reader sessions exchange every typography field and keep newer account values over stale book values',async()=>{
 const records=new Map();
 const api=async(url,opts={})=>{
  if(url==='/api/cloud')return Response.json({userId:'owner-1',displayName:'reader@example.test',books:[],states:[...records.values()]});
  if(url!=='/api/cloud/state')throw Error('Unexpected request: '+url);
  const record=JSON.parse(opts.body);records.set(record.deviceId+'|'+record.key,record);return Response.json({saved:true});
 };
 const appearance={fontSize:33,font:'literary',lineHeight:1.9,margin:44,paragraphGap:0,indent:1.7,letterSpacing:.6,align:'justify',hyphens:false,theme:'oled'};
 const a=harness({api});a.cloud.deviceId='device-a';a.cloud.owner='owner-1';
 await a.cloud.queue('settings',appearance,800);
 await a.cloud.queue('appearance:sample',appearance,800);
 await a.cloud.sync();
 let account={settings:{fontSize:22},updatedAt:100};
 let book={settings:{fontSize:18},updatedAt:200};let shown;
 const b=harness({api,bookList:[{id:'sample'}],callbacks:{
  remoteSettings:async r=>{account={settings:r.payload,updatedAt:r.clientUpdatedAt};shown=resolveReadingAppearance(account,book).settings;},
  remoteAppearance:async(_b,r)=>{book={settings:r.payload,updatedAt:r.clientUpdatedAt};shown=resolveReadingAppearance(account,book).settings;},
  localAppearance:()=>book
 }});b.cloud.deviceId='device-b';b.cloud.owner='owner-1';
 await b.cloud.sync();
 assert.deepEqual(shown,appearance);assert.equal(b.cloud.status,'Синхронизировано');
 await b.cloud.queue('position:sample',{anchor:{block:2,offset:0},bookSettings:{fontSize:17}},1000);await b.cloud.sync();
 assert.deepEqual(shown,appearance);
 const reloaded=harness({api,preferences:Object.fromEntries(b.prefs),callbacks:{remoteSettings:async r=>{shown=r.payload;}}});
 await reloaded.cloud.init();assert.deepEqual(shown,appearance);
});

test('an old reading position cannot override the cloud account appearance',async()=>{
 const oldKey='position:'+'e'.repeat(64);
 const state=[
  {deviceId:'new-device',key:'settings',payload:{fontSize:33,theme:'oled'},clientUpdatedAt:2000},
  {deviceId:'old-device',key:oldKey,payload:{anchor:{block:1,offset:0},bookSettings:{fontSize:15,theme:'paper'}},clientUpdatedAt:9000}
 ];
 let active=null;
 const h=harness({api:async(url,opts)=>{
   if(url==='/api/cloud')return Response.json({userId:'owner-1',displayName:'reader@example.test',books:[],states:state});
   const saved=JSON.parse(opts.body);state.push(saved);return Response.json({saved:true});
  },bookList:[{id:'e'.repeat(64),blocks:[{text:'test'}],appearanceSettings:null,appearanceUpdatedAt:0}],callbacks:{
   localAppearance:()=>null,
   remoteAppearance:async(_b,record)=>{active=record.payload},
   remoteSettings:async record=>{active=record.payload},
   remotePosition:async()=>{}
  }});
 h.cloud.deviceId='third-device';h.cloud.owner='owner-1';
 await h.cloud.sync();
 assert.deepEqual(active,{fontSize:33,theme:'oled'});
 assert.equal(h.cloud.status,'Синхронизировано');
});
