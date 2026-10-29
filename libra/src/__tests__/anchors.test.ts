// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {collectTextUnits,getPageAnchor,getAnchorPage} from '../anchors';

describe('content-based FB2 anchors',()=>{
 it('collects stable block/text offsets without changing DOM content',()=>{
  const flow=document.createElement('div');
  flow.innerHTML='<p data-block-index="0">Начало 🦔</p><div data-block-index="1">Последняя строка</div>';
  expect(collectTextUnits(flow).map(u=>[u.block,u.textNode,u.length])).toEqual([
   [0,0,'Начало 🦔'.length],[1,0,'Последняя строка'.length]
  ]);
  expect(flow.textContent).toBe('Начало 🦔Последняя строка');
 });
 it('returns null for an image-only page without manufacturing text',()=>{
  const flow=document.createElement('div');
  flow.innerHTML='<figure data-block-index="0"><img alt="image"></figure>';
  expect(getPageAnchor(flow,0,{width:320,gap:24})).toBeNull();
  expect(getAnchorPage(flow,{block:0,textNode:0,offset:0},{width:320,gap:24})).toBeNull();
 });
});
