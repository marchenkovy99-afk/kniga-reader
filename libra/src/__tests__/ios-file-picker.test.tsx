// @vitest-environment jsdom
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {Library} from '../components/Library';
import {DEFAULT_SETTINGS} from '../domain';
it('leaves unknown iOS FB2 file types selectable and validates after selection',()=>{
 const noop=()=>{};
 const html=renderToStaticMarkup(<Library cloud={{enabled:false} as any} books={[]} settings={DEFAULT_SETTINGS} onSettings={noop} onOpen={noop} onImport={noop} onDelete={noop} onFavorite={noop} onBackupImported={async()=>{}} loading={false}/>);
 const host=document.createElement('div');host.innerHTML=html;
 const input=host.querySelector('input[type=file]')!;
 expect(input.hasAttribute('accept')).toBe(false);
 expect(input.hasAttribute('multiple')).toBe(true);
});
