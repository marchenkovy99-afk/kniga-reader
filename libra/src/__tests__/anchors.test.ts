// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {collectTextUnits,getPageAnchor,getAnchorPage,columnAtOffset} from '../anchors';

describe('content-based FB2 anchors',()=>{
 it('never assigns a fractional Safari column start to the previous page',()=>{
  const geo={width:366,gap:24,stride:388.8};
  expect(columnAtOffset(0,geo)).toBe(0);
  expect(columnAtOffset(364,geo)).toBe(0);
  expect(columnAtOffset(388.7,geo)).toBe(1);
  expect(columnAtOffset(3*388.8-.8,geo)).toBe(3);
  expect(columnAtOffset(3*388.8+250,geo)).toBe(3);
 });
 it('collects stable block/text offsets without changing DOM content',()=>{
  const flow=document.createElement('div');
  flow.innerHTML='<p data-block-index="0">Начало 🦔</p><div data-block-index="1">Последняя строка</div>';
  expect(collectTextUnits(flow).map(u=>[u.block,u.textNode,u.length])).toEqual([
   [0,0,'Начало 🦔'.length],[1,0,'Последняя строка'.length]
  ]);
  expect(flow.textContent).toBe('Начало 🦔Последняя строка');
 });
 it('restores an image-only page from its block index',()=>{
  const flow=document.createElement('div');
  flow.innerHTML='<figure data-block-index="3"><img alt="Illustration"></figure>';
  const figure=flow.querySelector('figure')!;
  Object.defineProperty(flow,'getBoundingClientRect',{value:()=>({left:100,top:0,width:320,height:600})});
  Object.defineProperty(figure,'getBoundingClientRect',{value:()=>({left:444,top:5,width:310,height:490})});
  const geo={width:320,gap:24};
  const anchor=getPageAnchor(flow,1,geo);
  expect(anchor).toEqual({block:3,textNode:-1,offset:0});
  expect(getAnchorPage(flow,anchor!,geo)).toBe(1);
 });
 it('returns null for an unloaded image-only page without manufacturing text',()=>{
  const flow=document.createElement('div');
  flow.innerHTML='<figure data-block-index="0"><img alt="image"></figure>';
  expect(getPageAnchor(flow,0,{width:320,gap:24})).toBeNull();
  expect(getAnchorPage(flow,{block:0,textNode:0,offset:0},{width:320,gap:24})).toBeNull();
 });
});
