import { describe,it,expect } from 'vitest';
import { measureColumns,measureColumnStride,clampPage,restoreFraction,progressOf } from '../pagination';
describe('pagination math',()=>{
 it('measures one and multiple columns',()=>{
   expect(measureColumns(320,320,24)).toBe(1);
   expect(measureColumns(320*3+24*2,320,24)).toBe(3);
 });
 it('measures browser column origins instead of assuming exact CSS pixels',()=>{
   const flow=document.createElement('div');
   Object.defineProperty(flow,'getBoundingClientRect',{value:()=>({left:10})});
   const child=document.createElement('p');
   Object.defineProperty(child,'getClientRects',{value:()=>[
    {left:10,width:366,height:300},
    {left:398.8,width:364,height:300}
   ]});
   flow.appendChild(child);
   expect(measureColumnStride(flow,366,24)).toBeCloseTo(388.8,3);
   expect(measureColumnStride(flow,300,24)).toBe(324);
   expect(measureColumns(3*388.8-24,366,24,388.8)).toBe(3);
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
