import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReadingTimeStore,createReadingTimeSync} from './reading-time.js';
const storage=()=>{const map=new Map();return {get length(){return map.size},key:i=>[...map.keys()][i],getItem:key=>map.get(key)??null,setItem:(key,v)=>map.set(key,String(v))}};
const context={owner:'account',enabled:true,books:['a','b']};
test('separate book counters combine device components by maximum, never by repeated addition',()=>{
 const a=createReadingTimeStore(storage(),'device-a'),b=createReadingTimeStore(storage(),'device-b');
 a.add('account','a',60000,'2026-11-06');b.add('account','a',120000,'2026-11-06');a.add('account','b',30000,'2026-11-06');
 const rows=[...a.rows('account'),...b.rows('account')];a.merge('account',rows);a.merge('account',rows);
 assert.equal(a.summary('account','a','2026-11-06').total,180000);assert.equal(a.summary('account','b','2026-11-06').total,30000);
 assert.equal(a.summary('other','a','2026-11-06').total,0);
});
test('old totals migrate once, retaining today and earlier history',()=>{
 const s=storage();s.setItem('libra-reading-time:v1:account:a',JSON.stringify({version:1,total:120000,day:'2026-11-06',today:30000}));
 const a=createReadingTimeStore(s,'device-a');assert.equal(a.summary('account','a','2026-11-06').total,120000);a.summary('account','a','2026-11-06');assert.equal(a.summary('account','a','2026-11-06').today,30000);
});
test('offline retry and two devices converge without duplicating or losing reading time',async()=>{
 const remote=new Map(),transport={async upload(rows){for(const row of rows){const key=[row.book_id,row.replica_id,row.day].join('|');remote.set(key,{...row,total_ms:Math.max(remote.get(key)?.total_ms||0,row.total_ms)})}},async download(){return [...remote.values()]}};
 const a=createReadingTimeStore(storage(),'a'),b=createReadingTimeStore(storage(),'b');
 a.add('account','a',1000,'2026-11-06');b.add('account','a',2000,'2026-11-06');
 const as=createReadingTimeSync({store:a,context:async()=>context,transport}),bs=createReadingTimeSync({store:b,context:async()=>context,transport});
 await as();await bs();await as();await as();assert.equal(a.summary('account','a','2026-11-06').total,3000);
 b.add('account','a',500,'2026-11-06');await bs();await as();assert.equal(a.summary('account','a','2026-11-06').total,3500);
});
test('disabled sync does not upload and a late response after account change is ignored',async()=>{
 const a=createReadingTimeStore(storage(),'a');a.add('account','a',1000,'2026-11-06');let calls=0,current={...context,enabled:false};
 const sync=createReadingTimeSync({store:a,context:async()=>current,transport:{async upload(){calls++},async download(){current={...context,owner:'other'};return [{book_id:'a',replica_id:'remote',day:'2026-11-06',total_ms:5000}]}}});
 await sync();assert.equal(calls,0);current=context;await sync();assert.equal(a.summary('account','a','2026-11-06').total,1000);assert.equal(a.summary('other','a','2026-11-06').total,0);
});
test('accepted upload retried after a network error counts once and preserves new offline increments',async()=>{
 const a=createReadingTimeStore(storage(),'a');a.add('account','a',1000,'2026-11-06');let server=0,fail=true;
 const sync=createReadingTimeSync({store:a,context:async()=>context,transport:{async upload(rows){server=Math.max(server,rows[0].total_ms);if(fail){fail=false;a.add('account','a',500,'2026-11-06');throw Error('Network disconnected');}},async download(){return [{book_id:'a',replica_id:'a',day:'2026-11-06',total_ms:server}]}}});
 await assert.rejects(sync,/Network/);assert.equal(a.pending('account')[0].total_ms,1500);await sync();await sync();assert.equal(server,1500);assert.equal(a.summary('account','a','2026-11-06').total,1500);
});
test('upload acknowledgment does not clear increments made during the request',async()=>{
 const a=createReadingTimeStore(storage(),'a');a.add('account','a',1000,'2026-11-06');
 const sync=createReadingTimeSync({store:a,context:async()=>context,transport:{async upload(){a.add('account','a',500,'2026-11-06');},async download(){return [{book_id:'a',replica_id:'a',day:'2026-11-06',total_ms:1000}]}}});
 await sync();assert.equal(a.pending('account')[0].total_ms,1500);
});
test('guest totals attach to the first connected account only and keep their replica identity',()=>{
 const a=createReadingTimeStore(storage(),'a');a.add('guest','a',1000,'2026-11-06');a.adoptGuest('first',['a']);a.adoptGuest('first',['a']);a.adoptGuest('second',['a']);
 assert.equal(a.summary('first','a','2026-11-06').total,1000);assert.equal(a.summary('second','a','2026-11-06').total,0);
});
test('recovers reading time stored under the old callback scope without duplicate adoption',()=>{
 const a=createReadingTimeStore(storage(),'session');const wrong='(x,y)=>openFootnote(x,y)';
 a.add(wrong,'a',120000,'2026-11-06');
 assert.equal(a.summary('account','a','2026-11-06').total,120000);
 assert.equal(a.summary('account','a','2026-11-06').total,120000);
 assert.equal(a.summary('other','a','2026-11-06').total,0);
});
