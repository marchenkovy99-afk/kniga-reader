import {describe,it,expect} from 'vitest';
import {newestReadingPosition} from '../storage';
import type {ReaderPosition} from '../domain';

const at=(page:number,updatedAt:number):ReaderPosition=>({
 chapter:0,page,fraction:page/100,updatedAt
});
describe('monotonic position storage',()=>{
 it('does not let delayed older writes rewind reading progress',()=>{
  const recent=at(70,4000),delayed=at(12,1000);
  expect(newestReadingPosition(recent,delayed)).toEqual(recent);
  expect(newestReadingPosition(delayed,recent)).toEqual(recent);
 });
 it('keeps the most recently queued action for equal timestamps',()=>{
  const prior=at(8,2000),next=at(9,2000);
  expect(newestReadingPosition(prior,next)).toEqual(next);
 });
 it('accepts page reversals if the reader actually moved backwards later',()=>{
  const previous=at(70,2000),next=at(3,3000);
  expect(newestReadingPosition(previous,next)).toEqual(next);
 });
});
