// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {BookBlock} from '../reader/BookBlock';
describe('FB2 semantic rendering',()=>{
 it('renders emphasis and footnote controls without injecting book HTML',()=>{
  const html=renderToStaticMarkup(<BookBlock index={0} forceTableDialog={false} onMediaLoaded={()=>{}} onOpenTable={()=>{}}
   block={{kind:'paragraph',text:'Курсив оба1',inline:[{text:'Курсив ',emphasis:true},{text:'оба',strong:true,emphasis:true},{text:'1',note:'note'}]}}/>);
  const root=document.createElement('div');root.innerHTML=html;
  expect(root.querySelector('em')?.textContent).toContain('Курсив');
  expect(root.querySelector('strong em,em strong')?.textContent).toBe('оба');
  expect(root.querySelector('button[data-note]')?.textContent).toBe('1');
  expect(root.textContent).toBe('Курсив оба1');
 });
});
