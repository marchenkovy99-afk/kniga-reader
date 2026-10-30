// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {applyEpubAppearance,applyEpubInk} from '../reader/epubAppearance';
import {DEFAULT_SETTINGS} from '../domain';
import {enforceEpubUniformSpacing,configureEpub} from '../reader/epubLayout';
describe('EPUB live appearance',()=>{
 it('applies an exact body palette to one existing rendition',()=>{
  const changes=new Map<string,string>();
  const themes={override:(key:string,value:string)=>{changes.set(key,value)}};
  applyEpubAppearance(themes,{...DEFAULT_SETTINGS,theme:'paper'});
  expect(changes.get('background-color')).toBe('#F7F4EF');
  expect(changes.get('color')).toBe('#262522');
  applyEpubAppearance(themes,{...DEFAULT_SETTINGS,theme:'oled',fontSize:24,lineHeight:1.65,margin:12});
  expect(changes.get('background-color')).toBe('#000000');
  expect(changes.get('color')).toBe('#CBCBC9');
  expect(changes.get('font-size')).toBe('24px');
  expect(changes.get('line-height')).toBe('1.65');
  expect(changes.get('padding')).toBe('0px');
 });
 it('sets text alignment and font family without recreating the book',()=>{
  const entries:Record<string,string>={};
  applyEpubAppearance({override:(key,value)=>{entries[key]=value}},
   {...DEFAULT_SETTINGS,fontFamily:'sans',align:'left'});
  expect(entries['font-family']).toContain('Arial,sans-serif');
  expect(entries['text-align']).toBe('left');
  expect(entries.hyphens).toBe('auto');
  expect(entries['word-spacing']).toBe('0px');
  expect(entries['--libra-word-spacing']).toBe('0px');
  expect(entries['--libra-paragraph-gap']).toBe('0px');
 });
 it('updates EPUB ink and background in place',()=>{
  const changes:Record<string,string>={};
  applyEpubInk({override:(key,value)=>{changes[key]=value}}, {...DEFAULT_SETTINGS,theme:'night',textContrast:60});
  expect(changes['background-color']).toBe('#1D1F1E');
  expect(changes.color).not.toBe('#F2F0E9');
  applyEpubInk({override:(key,value)=>{changes[key]=value}}, {...DEFAULT_SETTINGS,theme:'oled',textContrast:100});
  expect(changes.color).toBe('#F2F2EF');
 });
});

describe('publisher spacing normalization',()=>{
 it('overrides publisher !important justification without rewriting EPUB text nodes',()=>{
  const doc=document.implementation.createHTMLDocument('publisher');
  doc.body.innerHTML='<p style="text-align:justify!important;word-spacing:18px!important">Первое <strong>второе</strong> третье.</p><p>Ещё текст.</p><pre style="word-spacing:15px!important">a   b</pre>';
  const original=doc.body.textContent;
  const paragraph=doc.querySelector('p')!;
  const firstText=paragraph.firstChild;
  enforceEpubUniformSpacing(doc);
  const sheet=doc.getElementById('libra-uniform-spaces')!.textContent||'';
  expect(sheet).toContain('word-spacing:var(--libra-word-spacing,0px)!important');
  expect(sheet).toContain('text-align:var(--libra-text-align,justify)!important');
  expect(paragraph.style.getPropertyValue('text-align')).toBe('var(--libra-text-align,justify)');
  expect(paragraph.style.getPropertyPriority('text-align')).toBe('important');
  expect(paragraph.style.getPropertyValue('word-spacing')).toBe('var(--libra-word-spacing,0px)');
  expect(doc.querySelector('pre')!.getAttribute('style')).toContain('15px');
  enforceEpubUniformSpacing(doc);
  expect(doc.querySelectorAll('#libra-uniform-spaces')).toHaveLength(1);
  expect(paragraph.firstChild).toBe(firstText);
  expect(doc.body.textContent).toBe(original);
 });
 it('registers the same spacing guard on EPUB measurement and reading renderers',()=>{
  const callbacks:((content:{document:Document})=>void)[]=[];
  const overrides:Record<string,string>={};
  const rendition={hooks:{content:{register:(fn:(content:{document:Document})=>void)=>callbacks.push(fn)}},themes:{
   default:(_:unknown)=>{},override:(key:string,value:string)=>{overrides[key]=value}
  }};
  configureEpub(rendition,DEFAULT_SETTINGS);
  expect(callbacks).toHaveLength(1);
  const doc=document.implementation.createHTMLDocument('chapter');
  doc.body.innerHTML='<p>Раз два три</p>';
  callbacks[0]({document:doc});
  expect(doc.getElementById('libra-uniform-spaces')).not.toBeNull();
  expect(overrides['--libra-word-spacing']).toBe('0px');
 });
});
