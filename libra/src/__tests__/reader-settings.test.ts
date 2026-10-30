// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {DEFAULT_SETTINGS} from '../domain';
import {normalizeSettings,fontStack,resetTypography,readingInk,maximumTextPreset,balancePageMargins} from '../readerSettings';
describe('reader typography normalization',()=>{
 it('retains zero page margins and spacing',()=>{
  const s=normalizeSettings({...DEFAULT_SETTINGS,margin:0,marginRight:0,verticalMargin:0,bottomMargin:0,paragraphSpacing:0,wordSpacing:0});
  for(const key of ['margin','marginRight','verticalMargin','bottomMargin','paragraphSpacing','wordSpacing'] as const)expect(s[key]).toBe(0);
 });
 it('automatically justifies existing libraries, including previous left alignment',()=>{
  expect(normalizeSettings({...DEFAULT_SETTINGS,align:'left'}).align).toBe('justify');
  expect(normalizeSettings({}).align).toBe('justify');
 });
 it('preserves the new word, letter, indent and vertical controls',()=>{
  const saved={...DEFAULT_SETTINGS,wordSpacing:2.5,letterSpacing:.4,paragraphSpacing:9,
   paragraphIndent:1.4,verticalMargin:20,fontFamily:'book' as const};
  const settings=normalizeSettings(saved);
  for(const key of ['wordSpacing','letterSpacing','paragraphSpacing','paragraphIndent','verticalMargin','fontFamily'] as const)
   expect(settings[key]).toBe(saved[key]);
 });
 it('fills missing old preferences and rejects invalid geometry',()=>{
  const settings=normalizeSettings({fontSize:NaN,lineHeight:10,wordSpacing:-99,margin:999} as any);
  expect(settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  expect(settings.lineHeight).toBe(2.2);
  expect(settings.margin).toBe(52);
  expect(settings.wordSpacing).toBe(0);
  expect(fontStack('screen')).toContain('Verdana');
  expect(settings.marginRight).toBe(52); // Legacy side margins migrate together.
  expect(settings.bottomMargin).toBe(DEFAULT_SETTINGS.verticalMargin);
 });
 it('migrates old symmetric margins and supports asymmetric page insets',()=>{
  const legacy=normalizeSettings({...DEFAULT_SETTINGS,margin:36,verticalMargin:24,
   marginRight:undefined,bottomMargin:undefined} as any);
  expect(legacy.marginRight).toBe(36);
  expect(legacy.bottomMargin).toBe(24);
  const asymmetric=normalizeSettings({...legacy,margin:10,marginRight:42,verticalMargin:4,bottomMargin:30,
   hyphenation:'none',fontWeight:600,fontSize:36});
  expect(asymmetric.marginRight).toBe(42);
  expect(asymmetric.bottomMargin).toBe(30);
  expect(asymmetric.fontWeight).toBe(600);
  expect(asymmetric.hyphenation).toBe('none');
  const reset=resetTypography({...asymmetric,theme:'oled',animation:'none'});
  expect(reset.marginRight).toBe(DEFAULT_SETTINGS.marginRight);
  expect(reset.theme).toBe('oled');
  expect(reset.animation).toBe('none');
 });
 it('softens dark ink without reducing light-theme contrast',()=>{
  expect(normalizeSettings({}).textContrast).toBe(84);
  expect(normalizeSettings({textContrast:Infinity} as any).textContrast).toBe(84);
  expect(normalizeSettings({textContrast:2} as any).textContrast).toBe(60);
  expect(readingInk({...DEFAULT_SETTINGS,theme:'oled'})).toBe('#CBCBC9');
  expect(readingInk({...DEFAULT_SETTINGS,theme:'oled',textContrast:100})).toBe('#F2F2EF');
  expect(readingInk({...DEFAULT_SETTINGS,theme:'paper',textContrast:60})).toBe('#262522');
 });
 it('offers zero inset density and balanced gutters without destroying preferences',()=>{
  const original={...DEFAULT_SETTINGS,theme:'night' as const,textContrast:70,margin:36,marginRight:8,verticalMargin:30,bottomMargin:6};
  const maximum=maximumTextPreset(original);
  expect([maximum.margin,maximum.marginRight,maximum.verticalMargin,maximum.bottomMargin]).toEqual([0,0,0,0]);
  expect(maximum.lineHeight).toBe(1.2);
  expect(maximum.textContrast).toBe(70);
  expect(maximum.theme).toBe('night');
  const balanced=balancePageMargins(original);
  expect([balanced.margin,balanced.marginRight,balanced.verticalMargin,balanced.bottomMargin]).toEqual([8,8,6,6]);
  expect(original.margin).toBe(36);
 });
});
