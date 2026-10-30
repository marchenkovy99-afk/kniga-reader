// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {PALETTES,setTheme} from '../theme';
import {readingInk} from '../readerSettings';
import {DEFAULT_SETTINGS} from '../domain';
const linear=(channel:number)=>{const c=channel/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4};
const luminance=(hex:string)=>{
 const v=[1,3,5].map(i=>linear(parseInt(hex.slice(i,i+2),16)));
 return .2126*v[0]+.7152*v[1]+.0722*v[2];
};
const contrast=(a:string,b:string)=>{
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};
describe('quiet dark reading themes',()=>{
 it.each(['night','oled'] as const)('%s retains sufficient text legibility without bright white glyphs',theme=>{
  const palette=PALETTES[theme],ink=readingInk({...DEFAULT_SETTINGS,theme});
  expect(contrast(palette.background,ink)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.background,palette.text)).toBeGreaterThanOrEqual(4.5);
  expect(Math.max(...[1,3,5].map(i=>parseInt(ink.slice(i,i+2),16)))).toBeLessThan(180);
 });
 it('sets the exact dark background and reader tokens without transparency filters',()=>{
  setTheme('night');
  expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#191C1B');
  expect(document.documentElement.style.getPropertyValue('--fg')).toBe('#C6C8C1');
  setTheme('oled');
  expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#000000');
  expect(document.documentElement.style.getPropertyValue('--fg')).toBe('#C0C2BC');
 });
});
