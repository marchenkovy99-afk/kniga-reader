import {parseFB2} from '../fb2';
import {decodeFB2Blob} from '../fb2Encoding';
import type {ParsedFB2,StoredBook} from '../domain';

/**
 * In-memory LRU for parsed FB2 documents. Returning to a book in the same
 * running PWA does not parse XML a second time. No stale cache across imports:
 * ids are generated per import. Parsed objects are not mutated by readers.
 */
const MAX_BOOKS=2;
const cache=new Map<string,Promise<ParsedFB2>>();
function remember(id:string,value:Promise<ParsedFB2>){
 cache.delete(id);cache.set(id,value);
 while(cache.size>MAX_BOOKS){
  const first=cache.keys().next().value;
  if(first!==undefined)cache.delete(first);
 }
}
export function seedParsedFB2(id:string,parsed:ParsedFB2):void{
 remember(id,Promise.resolve(parsed));
}
export function loadParsedFB2(book:StoredBook):Promise<ParsedFB2>{
 const hit=cache.get(book.id);
 if(hit){remember(book.id,hit);return hit}
 const result=decodeFB2Blob(book.file).then(parseFB2).catch(error=>{
  if(cache.get(book.id)===result)cache.delete(book.id);
  throw error;
 });
 remember(book.id,result);
 return result;
}
export function forgetParsedFB2(id:string):void{cache.delete(id)}
