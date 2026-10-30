import {describe,it,expect} from 'vitest';
import {bookPageLocation,bookPageNumber} from '../bookPagination';
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
