import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAccountState,bookBelongsToAccount} from '../reader/src/account-state.js';
const fixture=entries=>{const data=new Map(Object.entries(entries));return {data,getPreference:async k=>structuredClone(data.get(k)),setPreference:async(k,v)=>data.set(k,structuredClone(v)),listPreferenceKeys:async(prefix='')=>[...data.keys()].filter(k=>k.startsWith(prefix))};};
test('legacy local state migrates only to its original account and remains available offline',async()=>{
 const store=fixture({'settings':{fontSize:37},'position:book':{annotations:[{note:'A'}],status:'finished',coverImage:'data:image/png;base64,A'},'appearance:book':{settings:{fontSize:38},updatedAt:5}});
 const state=createAccountState(store);await state.migrateLegacy('a');await state.migrateLegacy('b');
 assert.equal((await state.forOwner('a').getPreference('settings')).fontSize,37);
 assert.equal(await state.forOwner('b').getPreference('settings'),undefined);
 assert.equal((await state.forOwner('a').getPreference('position:book')).status,'finished');
 assert.ok(store.data.has('position:book'));
});
test('a pinned account writer and guest adoption cannot overwrite another profile',async()=>{
 const store=fixture({}),state=createAccountState(store),guest=state.forOwner(null),a=state.forOwner('a'),b=state.forOwner('b');
 await guest.setPreference('settings',{fontSize:31});await a.setPreference('settings',{fontSize:35});
 await guest.setPreference('position:sample',{annotations:[{note:'guest'}]});await state.adoptGuest('a');
 assert.equal((await a.getPreference('settings')).fontSize,35);
 assert.equal((await a.getPreference('position:sample')).annotations[0].note,'guest');
 await a.setPreference('settings',{fontSize:39});assert.equal(await b.getPreference('settings'),undefined);
});
test('book membership includes only its accounts while the sample remains shared',()=>{
 assert.equal(bookBelongsToAccount({id:'book',cloudOwner:'a'},'b'),false);
 assert.equal(bookBelongsToAccount({id:'book',cloudOwner:'b',cloudOwners:['a','b']},'a'),true);
 assert.equal(bookBelongsToAccount({id:'sample'},'b'),true);
 assert.equal(bookBelongsToAccount({id:'guest'},null),true);
});
