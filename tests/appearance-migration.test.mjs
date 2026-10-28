import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createAccountState,bookBelongsToAccount} from '../reader/src/account-state.js';
import {restoreSettings} from '../reader/src/anchors.js';
import {bookAppearanceKey,legacyAppearanceTimestamp} from '../reader/src/sync-model.js';
const source=readFileSync(new URL('../reader/src/main.js',import.meta.url),'utf8');
test('startup migration normalizes old spacing without creating a new typography edit',async()=>{
 const prefs=new Map([['settings',{fontSize:31,paragraphGap:2}],['settings-updatedAt',125],['position:book',{updatedAt:9000,bookSettings:{fontSize:18},appearanceUpdatedAt:75}]]);
 const store={getPreference:async k=>prefs.get(k),setPreference:async(k,v)=>prefs.set(k,v),listPreferenceKeys:async()=>[...prefs.keys()],listBooks:async()=>[{id:'book',cloudOwner:'account-a'}]};
 const accounts=createAccountState(store);await accounts.migrateLegacy('account-a');
 const context={storage:store,localState:()=>accounts.forOwner('account-a'),bookBelongsToAccount,restoreSettings,bookAppearanceKey,legacyAppearanceTimestamp,localOwner:null,settings:{},settingsUpdatedAt:0,globalSettings:{},books:[],allBooks:[]};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('async function loadAccountState('),source.indexOf('function queueLocalState(')),context);
 await context.loadAccountState('account-a');
 assert.equal(context.settings.fontSize,31);
 assert.equal(context.settingsUpdatedAt,125);
 assert.equal(context.books[0].appearanceUpdatedAt,75);
 assert.equal((await accounts.forOwner('account-a').getPreference('settings-updatedAt')),125);
});

test('changing accounts clears cached sample notes and restores each offline profile',async()=>{
 const prefs=new Map(),sample={id:'sample',progress:{annotations:[{note:'embedded private data'}]},marks:[{label:'embedded'}]};
 const store={getPreference:async k=>structuredClone(prefs.get(k)),setPreference:async(k,v)=>prefs.set(k,structuredClone(v)),listPreferenceKeys:async()=>[...prefs.keys()],listBooks:async()=>[structuredClone(sample),{id:'a-book',cloudOwner:'a'}]};
 const state=createAccountState(store);
 await state.forOwner('a').setPreference('settings',{fontSize:37});await state.forOwner('a').setPreference('settings-updatedAt',700);
 await state.forOwner('a').setPreference('position:sample',{annotations:[{note:'A only'}],coverImage:'cover-a',status:'finished'});
 const context={storage:store,localState:()=>state.forOwner(context.localOwner),bookBelongsToAccount,restoreSettings,bookAppearanceKey,legacyAppearanceTimestamp,localOwner:null,settings:{},settingsUpdatedAt:0,globalSettings:{},books:[],allBooks:[]};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function loadAccountState('),source.indexOf('function queueLocalState(')),context);
 await context.loadAccountState('a');assert.equal(context.books[0].progress.annotations[0].note,'A only');assert.equal(context.books.length,2);
 await context.loadAccountState('b');assert.equal(context.books.length,1);assert.equal(context.books[0].progress,undefined);assert.equal(context.books[0].marks.length,0);assert.equal(context.settingsUpdatedAt,0);
 await state.forOwner('b').setPreference('position:sample',{annotations:[{note:'B only'}]});
 await context.loadAccountState('a');assert.equal(context.books[0].progress.annotations[0].note,'A only');assert.equal(context.books[0].progress.coverImage,'cover-a');assert.equal(context.books[0].progress.status,'finished');assert.equal(context.settings.fontSize,37);
});
