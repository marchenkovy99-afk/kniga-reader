// @vitest-environment jsdom
import {describe,it,expect,vi} from 'vitest';
import {collectTextUnits,invalidateAnchorIndex,getPageAnchor,getAnchorPage} from '../anchors';

describe('indexed chapter anchors',()=>{
 it('reuses one traversal across page flips and font relayout',()=>{
  const flow=document.createElement('div');
  flow.innerHTML=Array.from({length:5000},(_,i)=>'<p data-block-index="'+i+'">Абзац '+i+' 🦔.</p>').join('');
  const walker=vi.spyOn(document,'createTreeWalker');
  const first=collectTextUnits(flow);
  expect(first).toHaveLength(5000);
  const calls=walker.mock.calls.length;
  expect(calls).toBe(5000);
  for(let i=0;i<30;i++){
   expect(collectTextUnits(flow)).toBe(first);
  }
  expect(walker.mock.calls.length).toBe(calls);
  invalidateAnchorIndex(flow);
  expect(collectTextUnits(flow)).not.toBe(first);
  expect(walker.mock.calls.length).toBe(calls+5000);
  walker.mockRestore();
 });
 it('invalidates on a different chapter even if element counts match',()=>{
  const flow=document.createElement('div');
  flow.innerHTML='<p data-block-index="0">Первая глава</p>';
  const first=collectTextUnits(flow);
  flow.innerHTML='<p data-block-index="0">Вторая глава</p>';
  const second=collectTextUnits(flow);
  expect(second).not.toBe(first);
  expect(second[0].node.textContent).toBe('Вторая глава');
 });
 it('anchors a non-text table page without deleting any table cells',()=>{
  const flow=document.createElement('div');
  flow.innerHTML='<table data-block-index="2"><tbody><tr><td>Содержимое таблицы</td></tr></tbody></table>';
  const table=flow.querySelector('table')!;
  Object.defineProperty(flow,'getBoundingClientRect',{value:()=>({left:30,top:0,width:320,height:600})});
  Object.defineProperty(table,'getBoundingClientRect',{value:()=>({left:374,top:0,width:320,height:400})});
  const geo={width:320,gap:24};
  // JSDOM has no real table text layout. A real rendered column may
  // therefore use the structural table marker.
  const anchor=getPageAnchor(flow,1,geo);
  expect(anchor).toEqual({block:2,textNode:-1,offset:0});
  expect(getAnchorPage(flow,anchor!,geo)).toBe(1);
  expect(table.textContent).toBe('Содержимое таблицы');
 });
});
