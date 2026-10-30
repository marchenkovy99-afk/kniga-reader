// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {DEFAULT_SETTINGS} from '../domain';
import {normalizeSettings,fontStack} from '../readerSettings';
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
  expect(settings.lineHeight).toBe(2);
  expect(settings.margin).toBe(40);
  expect(settings.wordSpacing).toBe(0);
  expect(fontStack('screen')).toContain('Verdana');
 });
});
