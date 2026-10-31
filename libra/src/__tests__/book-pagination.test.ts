import {describe,it,expect} from 'vitest';
import {epubTocStartPages} from '../reader/epubNavigation';
import {bookPageLocation,bookPageNumber,chapterStartPages,stableBookPageNumber,restoredFB2Page,rebaseFB2Position} from '../bookPagination';
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

describe('exact reading-page restoration',()=>{
 it('keeps page 288 after Safari reindexes preceding chapters by two pages',()=>{
  const saved={chapter:1,page:7,globalPage:288};
  expect(bookPageNumber([278,20],1,7)).toBe(286);
  expect(stableBookPageNumber(saved,[278,20],1,7)).toBe(288);
  expect(stableBookPageNumber(saved,[278,20],1,8)).toBe(289);
  expect(stableBookPageNumber(saved,[278,20],1,6)).toBe(287);
 });
 it('uses true book pagination when no saved absolute page exists',()=>{
  expect(stableBookPageNumber({chapter:1,page:7},[278,20],1,7)).toBe(286);
  expect(stableBookPageNumber({chapter:1,page:7,globalPage:288},[278,20],0,5)).toBe(6);
 });
});

describe('iOS layout reflow preserves the last confirmed page',()=>{
 it('reopens saved 289 when a new Safari layout places its text two columns earlier',()=>{
  const saved={chapter:0,page:288,globalPage:289,layoutKey:'old-layout',updatedAt:15};
  const resolved=restoredFB2Page(saved,'new-layout',350,286);
  expect(resolved).toBe(286);
  const rebased=rebaseFB2Position(saved,resolved);
  expect(stableBookPageNumber(rebased,[350],0,resolved)).toBe(289);
  expect(rebased.updatedAt).toBe(15);
  expect(rebased.globalPage).toBe(289);
  expect(stableBookPageNumber(rebased,[350],0,resolved+1)).toBe(290);
 });
 it('prefers the saved exact physical column when the layout is identical',()=>{
  expect(restoredFB2Page({page:288,layoutKey:'same'},'same',350,286)).toBe(288);
 });
 it('preserves the source anchor when the saved column no longer exists',()=>{
  const saved={chapter:0,page:288,globalPage:289,layoutKey:'same'};
  const current=restoredFB2Page(saved,'same',287,286);
  expect(current).toBe(286);
  expect(stableBookPageNumber(rebaseFB2Position(saved,current),[287],0,current)).toBe(289);
 });
 it('keeps source position across subsequent layout measurements until user navigation',()=>{
  const saved={page:288,globalPage:289,layoutKey:'old-layout'};
  const first=rebaseFB2Position(saved,restoredFB2Page(saved,'new-layout',287,286));
  expect(restoredFB2Page(first,'new-layout',300,288,true)).toBe(288);
  expect(stableBookPageNumber(rebaseFB2Position(first,288),[300],0,288)).toBe(289);
 });
});
