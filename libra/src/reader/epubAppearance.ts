import type {ReaderSettings} from '../domain';
import {PALETTES} from '../theme';

/** Live styles for epub.js. Never tear down the rendition on appearance changes. */
export type EpubThemes={override:(property:string,value:string)=>void};
export function applyEpubAppearance(themes:EpubThemes,settings:ReaderSettings):void{
 const palette=PALETTES[settings.theme];
 const overrides:Record<string,string>={
  'background-color':palette.background,
  color:palette.text,
  'font-size':settings.fontSize+'px',
  'line-height':String(settings.lineHeight),
  'font-family':settings.fontFamily==='serif'?'Georgia, serif':'Arial, sans-serif',
  'text-align':settings.align,
  padding:'0 '+settings.margin+'px',
  hyphens:'auto'
 };
 for(const [key,value] of Object.entries(overrides))themes.override(key,value);
}
