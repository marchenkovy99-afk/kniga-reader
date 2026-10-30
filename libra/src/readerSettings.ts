import { DEFAULT_SETTINGS, type ReaderSettings } from './domain';

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
  fontSize:bounded(source.fontSize,14,32,DEFAULT_SETTINGS.fontSize),
  lineHeight:bounded(source.lineHeight,1.15,2,DEFAULT_SETTINGS.lineHeight),
  margin:bounded(source.margin,10,40,DEFAULT_SETTINGS.margin),
  verticalMargin:bounded(source.verticalMargin,0,32,DEFAULT_SETTINGS.verticalMargin),
  paragraphIndent:bounded(source.paragraphIndent,0,2.5,DEFAULT_SETTINGS.paragraphIndent),
  paragraphSpacing:bounded(source.paragraphSpacing,0,20,DEFAULT_SETTINGS.paragraphSpacing),
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
