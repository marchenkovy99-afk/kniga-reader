// @vitest-environment jsdom
import { describe,it,expect } from 'vitest';
import { bookmarkLocationLabel, sameBookmark } from '../bookmarks';
import type { ReaderPosition } from '../domain';
const p=(chapter:number,page:number):ReaderPosition=>({chapter,page,fraction:0,updatedAt:0});
describe('bookmark identity',()=>{
 it('recognizes a saved page and rejects a different page',()=>{
  expect(sameBookmark(p(0,3),p(0,3))).toBe(true);
  expect(sameBookmark(p(0,3),p(0,4))).toBe(false);
  expect(sameBookmark(p(0,3),p(1,3))).toBe(false);
 });
 it('prefers exact EPUB CFI over identical numeric page fields',()=>{
  expect(sameBookmark({...p(0,0),cfi:'epubcfi(/6/4)'},{...p(0,0),cfi:'epubcfi(/6/8)'})).toBe(false);
  expect(sameBookmark({...p(0,0),cfi:'epubcfi(/6/4)'},{...p(0,0),cfi:'epubcfi(/6/4)'})).toBe(true);
 });
 it('accepts stable anchor after text reflow',()=>{
  const anchor={block:15,textNode:0,offset:12};
  expect(sameBookmark({...p(2,8),anchor},{...p(2,12),anchor})).toBe(true);
  expect(sameBookmark({...p(2,8),anchor},{...p(3,8),anchor})).toBe(false);
 });
 it('labels the saved location with a useful format-specific position',()=>{
  expect(bookmarkLocationLabel(p(3,4),'fb2')).toContain('Глава 4');
  expect(bookmarkLocationLabel(p(0,12),'pdf')).toBe('Страница 13');
 });
});
