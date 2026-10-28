import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createAccountState} from '../reader/src/account-state.js';
import {createAppearanceWriter} from '../reader/src/appearance-writer.js';
const source=readFileSync(new URL('../reader/src/main.js',import.meta.url),'utf8');
function harness(){
 const prefs=new Map(),savedBooks=[],queued=[],messages=[];
 const store={getPreference:async k=>prefs.get(k),setPreference:async(k,v)=>prefs.set(k,structuredClone(v))};
 const accounts=createAccountState(store);
 const context={localOwner:'a',books:[],allBooks:[],settings:{fontSize:22},globalSettings:{fontSize:22},settingsUpdatedAt:0,appearanceWriters:new Map(),appearanceTail:Promise.resolve(),createAppearanceWriter,
  localState:owner=>accounts.forOwner(owner===undefined?context.localOwner:owner),
  base64ToFile:()=>new Uint8Array([1,2,3]),sha256:()=> 'book',importBook:async()=>({blocks:[],warnings:[]}),rememberBookOwner:()=>{},restoreSettings:x=>({...x}),
  shelfState:{restore:async b=>savedBooks.push(b)},library:async()=>{},cloud:{queue:(...x)=>queued.push(x),sync:()=>{}},message:x=>messages.push(x),document:{querySelector:()=>null}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function writeAppearance('),source.indexOf('const readingFullscreen=')),context);
 vm.runInContext(source.slice(source.indexOf('async function restoreBackup('),source.indexOf('\nconst reduced=')),context);
 const data={format:'kniga-backup',version:2,books:[{name:'a.txt',file:'AQID',progress:{annotations:[{note:'A private'}]}}],settings:{fontSize:39}};
 const file={size:100,text:async()=>JSON.stringify(data)};
 return {context,store,prefs,savedBooks,queued,messages,file,data};
}
for(const boundary of ['text','import','commit'])test('backup restore stops when account changes during '+boundary,async()=>{
 const h=harness();let release,started;
 const gate=new Promise(r=>release=r),entered=new Promise(r=>started=r);
 if(boundary==='text')h.file.text=async()=>{started();await gate;return JSON.stringify(h.data);};
 if(boundary==='import')h.context.importBook=async()=>{started();await gate;return {blocks:[],warnings:[]};};
 if(boundary==='commit')h.context.shelfState.restore=async b=>{h.savedBooks.push(b);started();await gate;};
 const restoring=h.context.restoreBackup(h.file);await entered;h.context.localOwner='b';release();await restoring;
 assert.equal([...h.prefs.keys()].some(k=>k.startsWith('account-state:b:')),false);
 assert.equal(h.context.books.length,0);assert.equal(h.context.globalSettings.fontSize,22);
 assert.ok(h.savedBooks.every(b=>b.cloudOwner==='a'));
 assert.equal(h.queued.length,0);
});
test('a settings restore already saving to disk stays pinned to its account',async()=>{
 const h=harness();h.data.books=[];let release,started;
 const gate=new Promise(r=>release=r),entered=new Promise(r=>started=r),save=h.store.setPreference;
 h.store.setPreference=async(k,v)=>{if(k.endsWith(':settings')){started();await gate;}return save(k,v);};
 const restoring=h.context.restoreBackup(h.file);await entered;h.context.localOwner='b';h.context.globalSettings={fontSize:25};release();await restoring;
 assert.equal(h.prefs.get('account-state:a:settings').fontSize,39);
 assert.equal(h.prefs.has('account-state:b:settings'),false);assert.equal(h.context.globalSettings.fontSize,25);
 assert.ok(h.queued.every(args=>args[3]==='a'));
});
test('an uninterrupted restore saves books, notes and typography to the selected account',async()=>{
 const h=harness();await h.context.restoreBackup(h.file);
 assert.equal(h.context.books.length,1);assert.equal(h.context.books[0].cloudOwner,'a');
 assert.equal(h.prefs.get('account-state:a:position:book').annotations[0].note,'A private');
 assert.equal(h.prefs.get('account-state:a:settings').fontSize,39);assert.equal(h.context.globalSettings.fontSize,39);
});
