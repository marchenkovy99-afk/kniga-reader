import {describe,it,expect} from 'vitest';
import {physicalPage} from '../reader/epubLayout';
describe('EPUB physical screens',()=>{
 it('increments for every rendered screen even within one old text location',()=>{
  const make=(page:number)=>({start:{index:2,location:7,displayed:{page,total:20},cfi:'cfi-'+page}});
  expect(physicalPage(make(1)).page).toBe(1);
  expect(physicalPage(make(2)).page).toBe(2);
  expect(physicalPage(make(3)).page).toBe(3);
 });
 it('uses actual chapter total rather than generated 1600-character locations',()=>{
  expect(physicalPage({start:{index:3,displayed:{page:8,total:11},cfi:'saved'}}))
   .toEqual({index:3,page:8,total:11,cfi:'saved'});
 });
});
