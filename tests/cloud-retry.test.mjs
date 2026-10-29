import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {sha256} from 'js-sha256';
import {bookBelongsToAccount} from '../reader/src/account-state.js';
import {createShelfState} from '../reader/src/shelf-state.js';
import {pendingForAccount,bookAppearanceKey,latestBookAppearance,latestReadingSettings,resolveReadingAppearance} from '../reader/src/sync-model.js';

const original=readFileSync(new URL('../reader/src/cloud.js',import.meta.url),'utf8');
function harness({preferences={},session={},api=null,bookList=[],callbacks={}}={}){
 const prefs=new Map(Object.entries(preferences)),tabs=new Map(Object.entries(session)),timers=new Map(),delays=[];
 let timerIndex=0,fetchCount=0,uploads=[],bookWrites=[];
 const storage={
   getPreference:async key=>prefs.get(key),
   setPreference:async(key,value)=>{prefs.set(key,structuredClone(value));},
   deletePreference:async key=>{prefs.delete(key);},
   listPreferenceKeys:async prefix=>[...prefs.keys()].filter(key=>key.startsWith(prefix)),
   putBook:async book=>bookWrites.push(structuredClone(book)),
   deleteBook:async()=>{}
 };
 const transport={
  api:async (url,opts={})=>{
   if(api)return api(url,opts);
   if(url==='/api/cloud/identity')return Response.json({userId:'owner-1'});
   if(url==='/api/cloud'){fetchCount++;return Response.json({userId:'owner-1',displayName:'reader@example.test',books:[],states:[]});}
   uploads.push(JSON.parse(opts.body));return Response.json({saved:true});
  }
 };
 const context={bookBelongsToAccount,pendingForAccount,bookAppearanceKey,latestBookAppearance,latestReadingSettings,crypto:globalThis.crypto,Response,storage,sessionStorage:{getItem:k=>tabs.get(k)||null,setItem:(k,v)=>tabs.set(k,v)},
   supabaseTransport:transport,shelfState:createShelfState(storage),
   mergeMarks:(...groups)=>groups.flat(),mergeAnnotations:(...groups)=>groups.flat(),
   newestState:(rows,key)=>rows.filter(x=>x.key===key).sort((a,b)=>b.clientUpdatedAt-a.clientUpdatedAt)[0],
   sha256,importBook:async()=>({blocks:[],chars:0}),
   setTimeout:(fn,delay)=>{delays.push(delay);const id=++timerIndex;timers.set(id,fn);return id;},
   clearTimeout:id=>timers.delete(id)};
 let code=original.replace(/^import .*?;\s*$/gm,'')
   .replaceAll("import.meta.env.MODE==='pages'","true")
   .replace('export class CloudSync','class CloudSync');
 code+='\nglobalThis.ReaderCloud=CloudSync;';
 vm.runInNewContext(code,context);
 const cloud=new context.ReaderCloud({books:()=>bookList,status:()=>{},...callbacks});
 return {cloud,prefs,tabs,timers,delays,uploads,bookWrites,get fetchCount(){return fetchCount;},async flush(){const all=[...timers.values()];timers.clear();for(const fn of all)await fn();await new Promise(setImmediate);}};
}

test('a book removed before login is not downloaded by the first account sync',async()=>{
 const original=new TextEncoder().encode('book'),id=sha256(original),calls=[];
 const h=harness({preferences:{'cloud-hidden:guest':[id]},api:async url=>{
  calls.push(url);if(url==='/api/cloud')return Response.json({userId:'owner-1',books:[{id,fileName:'book.txt'}],states:[]});
  return new Response(original);
 }});
 await h.cloud.init();
 assert.equal(calls.includes('/api/cloud/book/'+id),false);
 assert.equal(h.bookWrites.length,0);
 assert.equal(h.cloud.error,null);
});

test('deleting while a cloud file is in flight cannot put it back into storage or the shelf',async()=>{
 const original=new TextEncoder().encode('book'),id=sha256(original),added=[];
 const h=harness({api:async url=>{
  if(url==='/api/cloud')return Response.json({userId:'owner-1',books:[{id,fileName:'book.txt'}],states:[]});
  if(url==='/api/cloud/book/'+id){h.prefs.set('cloud-hidden:owner-1',[id]);return new Response(original);}
  throw Error('Unexpected request '+url);
 },callbacks:{addBook:book=>added.push(book)}});
 await h.cloud.init();
 assert.equal(h.bookWrites.length,0);
 assert.equal(added.length,0);
 assert.equal(h.cloud.error,null);
});
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
   if(url==='/api/cloud')return Response.json({userId:'owner-1',displayName:'reader@example.test',books:[{id:'e'.repeat(64),fileName:'test.fb2'}],states:state});
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

test('page progress uploads without fetching the complete cloud snapshot again',async()=>{
 const calls=[];
 const h=harness({api:async(url,opts={})=>{calls.push(url);if(url==='/api/cloud/identity')return Response.json({userId:'owner-1'});if(url==='/api/cloud')return Response.json({userId:'owner-1',books:[],states:[]});return Response.json({saved:true});}});
 await h.cloud.init();calls.length=0;
 await h.cloud.queue('position:sample',{anchor:{block:1,offset:3}},200);
 await h.cloud.sync({uploadOnly:true});
 assert.deepEqual(calls,['/api/cloud/identity','/api/cloud/state']);
 assert.equal(Object.keys(h.cloud.pending).length,0);
});
test('pause preserves offline edits and suppresses automatic network attempts',async()=>{
 const h=harness();await h.cloud.init();const count=h.fetchCount;
 h.cloud.pause();await h.cloud.queue('settings',{fontSize:31},300);await h.cloud.sync();await h.flush();
 assert.equal(h.fetchCount,count);assert.equal(h.cloud.pending.settings.clientUpdatedAt,300);
 h.cloud.resume();await h.cloud.sync();assert.equal(h.cloud.pending.settings,undefined);
});
test('an account switch during a lightweight upload cannot send the old account queue',async()=>{
 let writes=0;
 const h=harness({api:async(url)=>{if(url==='/api/cloud/identity')return Response.json({userId:'owner-2'});if(url==='/api/cloud')return Response.json({userId:'owner-1',books:[],states:[]});writes++;return Response.json({saved:true});}});
 await h.cloud.init();await h.cloud.queue('settings',{fontSize:31},300);await h.cloud.sync({uploadOnly:true});
 assert.equal(writes,0);assert.ok(h.cloud.pending.settings);
});
test('passive duplicate saves do not create a new pending upload',async()=>{
 const h=harness();await h.cloud.init();const payload={anchor:{block:2,offset:0},marks:[],annotations:[]};
 await h.cloud.queue('position:sample',payload,500);await h.cloud.sync();
 await h.cloud.queue('position:sample',payload,500);
 assert.equal(Object.keys(h.cloud.pending).length,0);
});

test('connection failures back off and paused requests never start a retry timer',async()=>{
 const h=harness({api:async()=>{throw new Error('offline');}});
 await h.cloud.init();assert.equal(h.delays.at(-1),15000);
 await h.cloud.sync();assert.equal(h.delays.at(-1),30000);
 h.cloud.pause();const count=h.delays.length;await h.cloud.sync();assert.equal(h.delays.length,count);assert.equal(h.timers.size,0);
});

test('recovered startup retry restarts the automatic polling lifecycle',async()=>{
 let calls=0,schedules=0;const h=harness({api:async()=>{if(++calls===1)throw Error('temporary network failure');return Response.json({userId:'owner-1',books:[],states:[]});},callbacks:{onSettled:()=>{if(h.cloud.user&&!h.cloud.error)schedules++;}}});
 await h.cloud.init();assert.equal(schedules,0);await h.flush();assert.equal(schedules,1);
});

test('restarting into account B never queues or applies account A book state',async()=>{
 const id='b'.repeat(64),key='position:'+id,writes=[],applied=[];
 const privateProgress={anchor:{block:0,offset:0},updatedAt:500,annotations:[{id:'private-a',note:'A private note'}]};
 const book={id,cloudOwner:'account-a',progress:privateProgress,marks:[{label:'A bookmark'}],appearanceSettings:{fontSize:37},appearanceUpdatedAt:500};
 const h=harness({preferences:{'cloud-owner':'account-a','kniga-installation-id':'device'},bookList:[book],api:async(url,opts={})=>{
  if(url==='/api/cloud')return Response.json({userId:'account-b',books:[],states:[{key,clientUpdatedAt:900,payload:{anchor:{block:0,offset:0},annotations:[{id:'b-note'}]}}]});
  if(url==='/api/cloud/identity')return Response.json({userId:'account-b'});
  writes.push({url,body:opts.body});return Response.json({saved:true});
 },callbacks:{localAppearance:b=>({settings:b.appearanceSettings,updatedAt:b.appearanceUpdatedAt}),remotePosition:()=>applied.push('position'),remoteAppearance:()=>applied.push('appearance')}});
 await h.cloud.init();
 // The real startup path used to replay every cached book after init switched accounts.
 await h.cloud.queue(key,book.progress,book.progress.updatedAt);
 await h.cloud.sync({uploadOnly:true});
 assert.deepEqual(writes,[]);
 assert.deepEqual(applied,[]);
 assert.deepEqual(book.progress,privateProgress);
});

test('a delayed save keeps its originating account across an account switch',async()=>{
 const h=harness();await h.cloud.init();
 await h.cloud.queue('settings',{fontSize:39},700,'other-account');
 await h.cloud.queue('position:sample',{annotations:[{note:'private'}]},700,'other-account');
 assert.deepEqual(Object.keys(h.cloud.pending),[]);
});

test('switching accounts restores their own queues and preserves unsent edits',async()=>{
 let account='account-a';const writes=[];
 const h=harness({api:async(url,opts={})=>{
  if(url==='/api/cloud')return Response.json({userId:account,books:[],states:[]});
  if(url==='/api/cloud/identity')return Response.json({userId:account});
  writes.push({account:opts.headers['x-cloud-owner'],record:JSON.parse(opts.body)});return Response.json({saved:true});
 }});
 await h.cloud.init();h.cloud.pause();await h.cloud.queue('settings',{fontSize:37},500);
 account='account-b';h.cloud.resume();await h.cloud.sync();
 assert.equal(writes.length,0);assert.equal(h.prefs.get('cloud-pending:account-a:'+h.cloud.deviceId).settings.payload.fontSize,37);
 account='account-a';await h.cloud.sync();assert.equal(writes[0].account,'account-a');assert.equal(writes[0].record.payload.fontSize,37);
});

test('a corrupt cloud book does not block other state uploads or the retry queue',async()=>{
 const id='a'.repeat(64),sent=[];
 const h=harness({api:async(url,opts={})=>{
  if(url==='/api/cloud')return Response.json({userId:'owner-1',displayName:'reader@example.test',books:[{id,fileName:'unreadable.fb2'}],states:[]});
  if(url==='/api/cloud/book/'+id)return new Response(new TextEncoder().encode('different bytes'));
  if(url==='/api/cloud/state'){sent.push(JSON.parse(opts.body));return Response.json({saved:true});}
  throw Error('Unexpected request: '+url);
 }});
 h.cloud.deviceId='offline-recovery';h.cloud.owner='owner-1';
 await h.cloud.queue('settings',{fontSize:28},450);
 await h.cloud.sync();
 assert.equal(sent.length,1,'pending settings are uploaded despite a damaged remote book');
 assert.equal(Object.keys(h.cloud.pending).length,0,'successful writes leave the pending queue');
 assert.match(h.cloud.status,/Частичная синхронизация/);
 assert.ok(h.cloud.retryTimer,'failed book download can be retried later');
 assert.equal(h.bookWrites.length,0,'invalid book bytes must not be saved');
});
test('a downloaded reading progress update refreshes the library without adding a book',async()=>{
 const key='position:'+'a'.repeat(64),updated=[],renders=[];
 const b={id:'a'.repeat(64),cloudOwner:'owner-1',blocks:[{text:'abc'}]};
 const h=harness({bookList:[b],api:async url=>{
  if(url==='/api/cloud')return Response.json({userId:'owner-1',books:[{id:b.id,fileName:'book.fb2'}],states:[{key,deviceId:'other-device',clientUpdatedAt:500,payload:{anchor:{block:0,offset:2}}}]});
  throw Error('Unexpected request: '+url);
 },callbacks:{remotePosition:async(_b,record)=>{updated.push(record);return true;},libraryChanged:()=>renders.push('refresh')}});
 h.cloud.deviceId='device-current';h.cloud.owner='owner-1';
 await h.cloud.sync();
 assert.equal(updated.length,1);
 assert.deepEqual(renders,['refresh']);
});
