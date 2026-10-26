import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createShelfState} from '../reader/src/shelf-state.js';

function disk(){
 const preferences=new Map(),books=new Map();
 return {preferences,books,getPreference:async key=>structuredClone(preferences.get(key)),setPreference:async(key,value)=>preferences.set(key,structuredClone(value)),deletePreference:async key=>preferences.delete(key),putBook:async book=>books.set(book.id,structuredClone(book)),deleteBook:async id=>books.delete(id)};
}
test('a removal survives restart and account sync while another account keeps its own shelf',async()=>{
 const store=disk(),shelf=createShelfState(store),book={id:'book'};await store.putBook(book);
 await shelf.hide(book.id,'a');const restarted=createShelfState(store);
 assert.equal(await restarted.commit(book,'a'),false);assert.equal(store.books.has('book'),false);
 assert.equal(await restarted.isHidden('book','b'),false);
});
test('guest removals transfer to the first signed-in account',async()=>{
 const store=disk(),shelf=createShelfState(store);await shelf.hide('book',null);await shelf.adoptGuest('a');
 assert.equal(await shelf.isHidden('book','a'),true);assert.equal(await shelf.isHidden('book','b'),false);assert.equal(await shelf.isHidden('book',null),false);
});
test('overlapping cloud commit and removal finish with the book removed from disk and the UI',async()=>{
 const store=disk(),shelf=createShelfState(store),shown=[];let release,started;
 const gate=new Promise(r=>release=r),writing=new Promise(r=>started=r),put=store.putBook;
 store.putBook=async book=>{started();await gate;await put(book);};
 const commit=shelf.commit({id:'book'},'a',book=>shown.push(book));await writing;
 const removal=shelf.hide('book','a',()=>shown.splice(0));release();await Promise.all([commit,removal]);
 assert.equal(store.books.has('book'),false);assert.equal(shown.length,0);assert.equal(await shelf.isHidden('book','a'),true);
});
test('parallel removals retain both markers and an explicit reimport restores only that book',async()=>{
 const store=disk(),shelf=createShelfState(store);await Promise.all([shelf.hide('one','a'),shelf.hide('two','a')]);
 assert.equal(await shelf.isHidden('one','a'),true);assert.equal(await shelf.isHidden('two','a'),true);
 await shelf.restore({id:'one'},'a');assert.equal(await shelf.isHidden('one','a'),false);assert.equal(await shelf.isHidden('two','a'),true);assert.equal(store.books.has('one'),true);
});
test('failed persistence reports the error and does not poison later shelf operations',async()=>{
 const store=disk(),shelf=createShelfState(store),set=store.setPreference;store.setPreference=async()=>{throw Error('disk full');};
 await assert.rejects(shelf.hide('one','a'),/disk full/);store.setPreference=set;await shelf.hide('two','a');assert.equal(await shelf.isHidden('two','a'),true);
});
