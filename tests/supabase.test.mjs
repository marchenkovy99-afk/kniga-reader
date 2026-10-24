import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseTransport} from '../reader/src/supabase-transport.js';
const signed=()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111',email:'reader@example.test'}},error:null});
test('cloud operations require a signed-in Supabase user',async()=>{
 const t=new SupabaseTransport({auth:{getUser:async()=>({data:{user:null},error:null})}});
 await assert.rejects(t.api('/api/cloud'),e=>e.status===401);
});
test('failed file uploads never create a library metadata row',async()=>{
 let wrote=false;const t=new SupabaseTransport({auth:{getUser:async()=>signed()},storage:{from:()=>({upload:async()=>({error:{message:'quota exceeded',statusCode:'413'}})})},from:()=>{wrote=true;throw Error('metadata must not be written');}});
 await assert.rejects(t.api('/api/cloud/book/'+'a'.repeat(64),{method:'PUT',body:new Uint8Array([1]).buffer,headers:{'x-book-name':'test.txt'}}),/quota exceeded/);
 assert.equal(wrote,false);
});
test('invalid book identifiers are rejected before accessing storage',async()=>{
 const t=new SupabaseTransport({auth:{getUser:async()=>signed()}});
 await assert.rejects(t.api('/api/cloud/book/../another-user',{method:'GET'}),/Некорректный/);
});

test('Supabase stores book appearance independently of reading position',async()=>{
 const uid='11111111-1111-4111-8111-111111111111';
 let saved;const t=new SupabaseTransport({
  auth:{getUser:async()=>signed()},
  from:()=>({upsert(values,options){saved={values,options};return Promise.resolve({error:null});}})
 });
 const key='appearance:'+'a'.repeat(64),payload={fontSize:35,margin:48,lineHeight:1.9,theme:'oled',font:'literary'};
 const response=await t.api('/api/cloud/state',{method:'PUT',body:JSON.stringify({deviceId:uid,key,payload,clientUpdatedAt:200})});
 assert.equal((await response.json()).saved,true);
 assert.equal(saved.values.key,key);
 assert.deepEqual(saved.values.payload,payload);
});
