import { describe,it,expect } from 'vitest';
import { measureColumns,clampPage,restoreFraction,progressOf } from '../pagination';
describe('pagination math',()=>{
 it('measures one and multiple columns',()=>{
   expect(measureColumns(320,320,24)).toBe(1);
   expect(measureColumns(320*3+24*2,320,24)).toBe(3);
 });
 it('never selects an invalid page',()=>{
   expect(clampPage(-10,5)).toBe(0);
   expect(clampPage(100,5)).toBe(4);
   expect(restoreFraction(.5,5)).toBe(2);
 });
 it('produces bounded progress',()=>{
   expect(progressOf(0,0,2,10)).toBe(0);
   expect(progressOf(20,0,1,10)).toBe(100);
 });
});
