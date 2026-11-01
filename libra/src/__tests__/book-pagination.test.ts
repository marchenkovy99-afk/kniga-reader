import {describe,it,expect} from 'vitest';
import {epubTocStartPages} from '../reader/epubNavigation';
import {bookPageLocation,bookPageNumber,chapterStartPages} from '../bookPagination';
describe('whole-book page navigation',()=>{
 it('maps boundaries and the final page without losing a chapter',()=>{
  expect(bookPageLocation([3,1,6],1)).toEqual({chapter:0,page:0});
  expect(bookPageLocation([3,1,6],4)).toEqual({chapter:1,page:0});
  expect(bookPageLocation([3,1,6],5)).toEqual({chapter:2,page:0});
  expect(bookPageLocation([3,1,6],999)).toEqual({chapter:2,page:5});
  expect(bookPageNumber([3,1,6],2,5)).toBe(10);
 });
 it('clamps malformed requests and keeps single-page books usable',()=>{
  expect(bookPageLocation([1],NaN)).toEqual({chapter:0,page:0});
  expect(bookPageLocation([2,3],-7)).toEqual({chapter:0,page:0});
  expect(bookPageLocation([2,3],2.9)).toEqual({chapter:0,page:1});
  expect(bookPageNumber([2,3],1,0)).toBe(3);
 });
});

describe('chapter start pages',()=>{
 it('uses page one and cumulative FB2 page counts, without guessing unknown chapters',()=>{
  expect(chapterStartPages([6,3,2])).toEqual([1,7,10]);
  expect(chapterStartPages([6,0,2])).toEqual([1,7,undefined]);
  expect(chapterStartPages([0,3])).toEqual([1,undefined]);
 });
 it('maps EPUB TOC anchors inside spine sections to their physical pages',()=>{
  const spine=[{index:0},{index:1},{index:2}];
  const locations={0:{index:0,page:1},1:{index:0,page:4},2:{index:1,page:2},3:{index:2,page:1}};
  expect(epubTocStartPages(spine,{0:9,1:5,2:2},locations,4)).toEqual([1,4,11,15]);
  expect(epubTocStartPages(spine,{0:9,1:0,2:2},locations,4)).toEqual([1,4,undefined,undefined]);
  expect(epubTocStartPages(spine,{0:9,1:5,2:2},{0:{index:0,page:10}},2)).toEqual([undefined,undefined]);
 });
});
