// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {DEFAULT_SETTINGS} from '../domain';
import {normalizeSettings,fontStack,resetTypography} from '../readerSettings';
describe('reader typography normalization',()=>{
 it('migrates persisted stretched justification to even spaces',()=>{
  const old={...DEFAULT_SETTINGS,align:'justify' as const};
  expect(normalizeSettings(old).align).toBe('left');
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
});
