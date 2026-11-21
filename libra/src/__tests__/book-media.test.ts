// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {prepareBookMedia,settleBookDocument,illustrationFromElement,isIllustrationActivation} from '../reader/bookMedia';
describe('original illustration rendering',()=>{
 it('preserves authored SVG root ink and external presentation CSS in the viewer',()=>{
  document.head.innerHTML='<style>.red-shape { fill: rgb(220, 10, 20); stroke: rgb(20, 30, 240) }</style>';
  document.body.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10" style="fill:red;stroke:blue"><path class="red-shape" d="M0 0h10v10z"/></svg>';
  const result=illustrationFromElement(document.querySelector('svg'))!;
  const svg=new DOMParser().parseFromString(decodeURIComponent(result.src.split(',').slice(1).join(',')),'image/svg+xml').documentElement as unknown as SVGElement;
  expect(svg.style.fill).toBe('red');expect(svg.style.stroke).toBe('blue');
  expect((svg.querySelector('path') as SVGElement).style.fill).toBe('rgb(220, 10, 20)');
 });
 it('accepts only activation keys from an EPUB iframe realm',()=>{
  const frame=document.createElement('iframe');document.body.append(frame);
  const Constructor=(frame.contentWindow as any).KeyboardEvent;
  expect(isIllustrationActivation(new Constructor('keydown',{key:'Tab'}))).toBe(false);
  expect(isIllustrationActivation(new Constructor('keydown',{key:'ArrowRight'}))).toBe(false);
  expect(isIllustrationActivation(new Constructor('keydown',{key:'Enter'}))).toBe(true);
  expect(isIllustrationActivation(new Event('click'))).toBe(true);frame.remove();
 });
 it('uses a light surface, fits images and preserves authored SVG ink',()=>{
  document.body.innerHTML='<p><img src="data:image/png;base64,AA==" style="filter:invert(1)!important;width:1800px;height:3200px"/></p><svg viewBox="0 0 20 10"><path fill="black" d="M0 0h10v10z"/></svg>';
  const cleanup=prepareBookMedia(document);
  const img=document.querySelector('img')!;
  expect(img.style.getPropertyValue('background-color')).toBe('rgb(255, 255, 255)');
  expect(img.style.getPropertyValue('filter')).toBe('none');
  expect(img.style.getPropertyValue('width')).toBe('auto');
  expect(img.style.getPropertyValue('height')).toBe('auto');
  expect(document.querySelector('svg path')!.getAttribute('fill')).toBe('black');
  expect(img.parentElement!.style.lineHeight).toBe('0');
  cleanup();
 });
 it('does not await a broken image forever',async()=>{
  document.body.innerHTML='<img src="broken"/>';
  Object.defineProperty(document.querySelector('img'),'decode',{value:()=>Promise.reject(new Error('broken'))});
  await expect(settleBookDocument(document)).resolves.toBeUndefined();
 });
});
