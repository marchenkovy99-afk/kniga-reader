// @vitest-environment jsdom
import { describe,it,expect } from 'vitest';
import { PALETTES,setTheme } from '../theme';
describe('theme shell',()=>{
 it('keeps the same background in body and status-bar theme metadata',()=>{
   document.head.innerHTML='<meta name="theme-color" content="#fff">';
   for(const name of ['paper','white','night','oled'] as const){
     setTheme(name);
     expect(document.documentElement.style.getPropertyValue('--bg')).toBe(PALETTES[name].background);
     expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(PALETTES[name].background);
   }
 });
});
