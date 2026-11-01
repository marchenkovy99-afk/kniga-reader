import {describe,it,expect} from 'vitest';
import {flattenEpubToc,chapterForHref} from '../reader/epubNavigation';
import {sortLibraryBooks} from '../librarySort';
import type {StoredBook} from '../domain';
describe('EPUB navigation',()=>{
 it('flattens nested EPUB2/EPUB3 TOCs with original hrefs',()=>{
  const toc=flattenEpubToc([{label:'Часть первая',href:'part.xhtml',
    subitems:[{label:'Глава 1',href:'first.xhtml#start'},{label:'Глава 2',href:'second.xhtml'}]}]);
  expect(toc).toHaveLength(3);
  expect(chapterForHref('OEBPS/second.xhtml',toc)).toBe(2);
  expect(chapterForHref('OEBPS/first.xhtml',toc)).toBe(1);
  expect(chapterForHref('OEBPS/missing.xhtml',toc)).toBe(0);
 });
 it('bounds path traversal and ignores invalid entries',()=>{
  const input=[{label:'  ',href:'one.xhtml'},{label:'No link',subitems:[{label:'Child',href:'two.xhtml'}]}];
  expect(flattenEpubToc(input)).toEqual([
   {title:'Без названия',href:'one.xhtml'},{title:'Child',href:'two.xhtml'}
  ]);
 });
});
describe('library ordering',()=>{
 const b=(id:string,title:string,author:string,fraction:number,opened:number)=>({
  id,title,author,importedAt:1,lastOpenedAt:opened,position:{chapter:0,page:0,updatedAt:0,fraction},
  file:new Blob(),filename:id,format:'fb2' as const,bookmarks:[]
 } satisfies StoredBook);
 const all=[b('a','Яблоко','Б',.2,3),b('b','Альфа','А',.9,2),b('c','Зима','А',.4,6)];
 it('sorts recent, title, author and progress without mutating original collection',()=>{
  const orig=[...all];
  expect(sortLibraryBooks(all,'recent').map(x=>x.id)).toEqual(['c','a','b']);
  expect(sortLibraryBooks(all,'title').map(x=>x.id)).toEqual(['b','c','a']);
  expect(sortLibraryBooks(all,'progress').map(x=>x.id)).toEqual(['b','c','a']);
  expect(sortLibraryBooks(all,'author').map(x=>x.id)).toEqual(['b','c','a']);
  expect(all).toEqual(orig);
 });
});
