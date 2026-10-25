import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attachBookSelectionMenu} from '../reader/src/selection-menu.js';
test('book context menu is cancelled and offers the reader actions',()=>{
 let listener,offered=0;
 const text={},stage={addEventListener:(type,fn)=>{assert.equal(type,'contextmenu');listener=fn;},contains:el=>el===text};
 attachBookSelectionMenu(stage,()=>offered++);
 const event=new Event('contextmenu',{cancelable:true});
 Object.defineProperty(event,'target',{value:{closest:selector=>selector==='.book-text'?text:null}});
 listener(event);
 assert.equal(event.defaultPrevented,true);assert.equal(offered,1);
});
test('fields and content outside the book retain their standard menu',()=>{
 for(const field of [true,false]){
  let listener,offered=0;const text={};
  const stage={addEventListener:(_type,fn)=>{listener=fn;},contains:()=>true};
  attachBookSelectionMenu(stage,()=>offered++);
  const event=new Event('contextmenu',{cancelable:true});
  Object.defineProperty(event,'target',{value:{closest:selector=>selector==='.book-text'?(field?text:null):field?{}:null}});
  listener(event);assert.equal(event.defaultPrevented,false);assert.equal(offered,0);
 }
});
