import { DEFAULT_SETTINGS, type ReaderSettings } from './domain';
import { PALETTES } from './theme';

/**
 * Validate old IndexedDB preferences before applying them.
 * Previous LIBRA builds persisted full justification: it produced huge gaps
 * on narrow Russian-language lines. Readable left alignment is always used.
 * User controls adjust the *uniform* space width, never the line's distribution.
 */
const bounded=(input:unknown,min:number,max:number,fallback:number):number=>
 typeof input==='number'&&Number.isFinite(input)
  ?Math.min(max,Math.max(min,input)):fallback;

export function normalizeSettings(saved:Partial<ReaderSettings>|undefined):ReaderSettings{
 const source=saved||{};
 const font=source.fontFamily;
 const family=font==='serif'||font==='sans'||font==='book'||font==='screen'?
  font:DEFAULT_SETTINGS.fontFamily;
 const theme=['paper','white','night','oled'].includes(source.theme||'')?
  source.theme!:DEFAULT_SETTINGS.theme;
 return {
  ...DEFAULT_SETTINGS,
  theme,
  fontFamily:family,
  align:'left',
  animation:source.animation==='none'?'none':'slide',
  fontSize:bounded(source.fontSize,12,36,DEFAULT_SETTINGS.fontSize),
  lineHeight:bounded(source.lineHeight,1.1,2.2,DEFAULT_SETTINGS.lineHeight),
  margin:bounded(source.margin,0,52,DEFAULT_SETTINGS.margin),
  marginRight:bounded(source.marginRight,0,52,bounded(source.margin,0,52,DEFAULT_SETTINGS.margin)),
  verticalMargin:bounded(source.verticalMargin,0,52,DEFAULT_SETTINGS.verticalMargin),
  bottomMargin:bounded(source.bottomMargin,0,52,bounded(source.verticalMargin,0,52,DEFAULT_SETTINGS.verticalMargin)),
  fontWeight:bounded(source.fontWeight,400,600,DEFAULT_SETTINGS.fontWeight),
  hyphenation:source.hyphenation==='none'?'none':'auto',
  textContrast:bounded(source.textContrast,60,100,DEFAULT_SETTINGS.textContrast),
  paragraphIndent:bounded(source.paragraphIndent,0,2.5,DEFAULT_SETTINGS.paragraphIndent),
  paragraphSpacing:bounded(source.paragraphSpacing,0,24,DEFAULT_SETTINGS.paragraphSpacing),
  wordSpacing:bounded(source.wordSpacing,0,5,DEFAULT_SETTINGS.wordSpacing),
  letterSpacing:bounded(source.letterSpacing,-0.5,1.5,DEFAULT_SETTINGS.letterSpacing)
 };
}
export const fontStack=(family:ReaderSettings['fontFamily'])=>{
 switch(family){
  case 'book': return '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif';
  case 'serif': return 'Georgia,"Times New Roman",serif';
  case 'screen': return 'Verdana,Geneva,sans-serif';
  default: return '-apple-system,BlinkMacSystemFont,Arial,sans-serif';
 }
};

/** Restore the typography preset without altering the selected theme. */
export function resetTypography(current:ReaderSettings):ReaderSettings{
 return {...DEFAULT_SETTINGS,theme:current.theme,animation:current.animation};
}

/** Blend page glyphs with the paper colour; toolbar contrast remains unchanged. */
export function readingInk(settings:Pick<ReaderSettings,'theme'|'textContrast'>):string{
 const palette=PALETTES[settings.theme];
 if(settings.theme!=='night'&&settings.theme!=='oled')return palette.text;
 const ratio=bounded(settings.textContrast,60,100,DEFAULT_SETTINGS.textContrast)/100;
 return '#'+[1,3,5].map(start=>{
  const foreground=parseInt(palette.text.slice(start,start+2),16);
  const background=parseInt(palette.background.slice(start,start+2),16);
  return Math.round(background+(foreground-background)*ratio).toString(16).padStart(2,'0');
 }).join('').toUpperCase();
}
/** Maximum useful lines; never remove the iOS safe-area clearance. */
export function maximumTextPreset(current:ReaderSettings):ReaderSettings{
 return {...current,fontSize:Math.min(current.fontSize,17),lineHeight:1.2,
  margin:0,marginRight:0,verticalMargin:0,bottomMargin:0,
  paragraphIndent:1,paragraphSpacing:0,wordSpacing:0,letterSpacing:0};
}
/** Use each pair's narrower margin to eliminate uneven page gutters. */
export function balancePageMargins(current:ReaderSettings):ReaderSettings{
 const horizontal=Math.min(current.margin,current.marginRight);
 const vertical=Math.min(current.verticalMargin,current.bottomMargin);
 return {...current,margin:horizontal,marginRight:horizontal,verticalMargin:vertical,bottomMargin:vertical};
}
