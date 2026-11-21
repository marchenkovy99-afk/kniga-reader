import {describe,it,expect} from 'vitest';
import {physicalPage,restoreEpubPhysicalPage} from '../reader/epubLayout';
describe('EPUB physical screens',()=>{
 it('restores an illustration-only screen by physical page only when its layout matches',()=>{
  const saved={chapter:2,page:4,fraction:.5,cfi:'epubcfi(saved)',updatedAt:1,layout:'390:700:font'};
  expect(restoreEpubPhysicalPage(saved,'390:700:font',2,10)).toBe(4);
  expect(restoreEpubPhysicalPage(saved,'390:700:newfont',2,10)).toBeNull();
  expect(restoreEpubPhysicalPage(saved,'390:700:font',1,10)).toBeNull();
  expect(restoreEpubPhysicalPage({...saved,page:99},saved.layout,2,10)).toBeNull();
 });
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
