import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../reader/src/main.js',import.meta.url),'utf8');
const update=source.split('\n').find(line=>line.includes("storage.getPreference('pagination-cache:'+last.id).then"));
for(const boundary of ['screen','account','none'])test('deferred shelf cache update respects '+boundary+' changes',async()=>{
 let resolve;const gate=new Promise(r=>resolve=r),writes=[];
 const slot={querySelector:()=>({set textContent(value){writes.push(value);}})};
 const context={last:{id:'a',progress:{anchor:{block:0,offset:0}}},previousPagination:null,owner:'account-a',localOwner:'account-a',slot,
  document:{querySelector:()=>context.slot},storage:{getPreference:()=>gate},pageForAnchor:()=>0};
 vm.createContext(context);vm.runInContext(update,context);
 if(boundary==='screen')context.slot={};
 if(boundary==='account')context.localOwner='account-b';
 resolve({entries:[{pages:[{}]}]});await gate;await Promise.resolve();
 assert.equal(writes.length,boundary==='none'?1:0);
});
