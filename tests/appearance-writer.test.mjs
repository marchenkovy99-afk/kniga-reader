import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAppearanceWriter} from '../reader/src/appearance-writer.js';
test('editing an open book saves and queues both the account and book typography',async()=>{
 const prefs=new Map(),queued=[];
 const write=createAppearanceWriter({setPreference:async(k,v)=>prefs.set(k,v)},async(...args)=>queued.push(args));
 const settings={fontSize:32,font:'literary',margin:40,lineHeight:1.8,letterSpacing:.3,indent:1.4,paragraphGap:0,theme:'oled',align:'justify',hyphens:false};
 await write({bookId:'a'.repeat(64),settings,updatedAt:500});
 assert.deepEqual(prefs.get('settings'),settings);assert.equal(prefs.get('settings-updatedAt'),500);
 assert.deepEqual(prefs.get('appearance:'+'a'.repeat(64)),{settings,updatedAt:500});
 assert.deepEqual(queued.map(r=>r[0]),['settings','appearance:'+'a'.repeat(64)]);
 assert.deepEqual(queued[0][1],settings);assert.deepEqual(queued[1][1],settings);
});
test('rapid edits cannot persist an older font size after the newer edit',async()=>{
 const prefs=new Map();let release;
 const blocked=new Promise(r=>release=r);let first=true;
 const write=createAppearanceWriter({setPreference:async(k,v)=>{if(first){first=false;await blocked;}prefs.set(k,v);}},async()=>{});
 const old=write({bookId:'sample',settings:{fontSize:18},updatedAt:100});
 const next=write({bookId:'sample',settings:{fontSize:34},updatedAt:200});
 release();await Promise.all([old,next]);
 assert.equal(prefs.get('settings').fontSize,34);assert.equal(prefs.get('appearance:sample').settings.fontSize,34);assert.equal(prefs.get('settings-updatedAt'),200);
});
