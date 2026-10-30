import type {ReaderSettings} from '../domain';
import {PALETTES} from '../theme';
import {fontStack} from '../readerSettings';

/** Live styles for epub.js. Never tear down the rendition on appearance changes. */
export type EpubThemes={override:(property:string,value:string)=>void};
export function applyEpubAppearance(themes:EpubThemes,settings:ReaderSettings):void{
 const palette=PALETTES[settings.theme];
 const overrides:Record<string,string>={
  'background-color':palette.background,
  color:palette.text,
  'font-size':settings.fontSize+'px',
  'font-weight':String(settings.fontWeight),
  'line-height':String(settings.lineHeight),
  'font-family':fontStack(settings.fontFamily),
  'text-align':'left',
  'word-spacing':settings.wordSpacing+'px',
  'letter-spacing':settings.letterSpacing+'px',
  '--libra-paragraph-gap':settings.paragraphSpacing+'px',
  '--libra-paragraph-indent':settings.paragraphIndent+'em',
  padding:settings.verticalMargin+'px '+settings.marginRight+'px '+settings.bottomMargin+'px '+settings.margin+'px',
  hyphens:settings.hyphenation
 };
 for(const [key,value] of Object.entries(overrides))themes.override(key,value);
}
