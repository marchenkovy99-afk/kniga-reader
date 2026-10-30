import {describe,it,expect} from 'vitest';
import {applyEpubAppearance} from '../reader/epubAppearance';
import {DEFAULT_SETTINGS} from '../domain';
describe('EPUB live appearance',()=>{
 it('applies an exact body palette to one existing rendition',()=>{
  const changes=new Map<string,string>();
  const themes={override:(key:string,value:string)=>{changes.set(key,value)}};
  applyEpubAppearance(themes,{...DEFAULT_SETTINGS,theme:'paper'});
  expect(changes.get('background-color')).toBe('#F6F3EC');
  expect(changes.get('color')).toBe('#222321');
  applyEpubAppearance(themes,{...DEFAULT_SETTINGS,theme:'oled',fontSize:24,lineHeight:1.65,margin:12});
  expect(changes.get('background-color')).toBe('#000000');
  expect(changes.get('color')).toBe('#F2F2EF');
  expect(changes.get('font-size')).toBe('24px');
  expect(changes.get('line-height')).toBe('1.65');
  expect(changes.get('padding')).toBe('12px 20px 12px 12px');
 });
 it('sets text alignment and font family without recreating the book',()=>{
  const entries:Record<string,string>={};
  applyEpubAppearance({override:(key,value)=>{entries[key]=value}},
   {...DEFAULT_SETTINGS,fontFamily:'sans',align:'left'});
  expect(entries['font-family']).toContain('Arial,sans-serif');
  expect(entries['text-align']).toBe('left');
  expect(entries.hyphens).toBe('auto');
  expect(entries['word-spacing']).toBe('0px');
  expect(entries['--libra-paragraph-gap']).toBe('0px');
 });
});
