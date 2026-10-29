export function applyTypography(element,s,width){
 const margin=Math.min(s.margin,Math.max(8,(width-150)/2));
 // A first-line indent must leave room for actual letters at the chosen
 // font size. Extreme combinations of margin, font and indent used to push
 // the very first glyph outside the page and make pagination fail entirely.
 // Keep the saved user preference unchanged; only clamp its painted geometry.
 const contentWidth=Math.max(0,width-2*margin);
 const minimumTextRoom=Math.min(contentWidth,Math.max(48,3.2*s.fontSize+2*Math.max(0,s.letterSpacing)));
 const indentPx=Math.max(0,Math.min((Number(s.indent)||0)*s.fontSize,contentWidth-minimumTextRoom));
 // A font's glyph rectangle can extend above and below its CSS line box.
 // With 48px Georgia at line-height:1, the previous 2px padding placed its
 // first glyph at y=-1px. A strict (correct) clip validator then rejected
 // even a single character. Reserve only the measured-size safety allowance;
 // ordinary reading settings keep their existing compact 2px top inset.
 const glyphOverhang=Math.max(0,((1.15-Number(s.lineHeight))*s.fontSize)/2);
 const topClearance=Math.max(2,Math.ceil(glyphOverhang+2));
 const bottomClearance=Math.max(4,Math.ceil(glyphOverhang+3));
 const variables={'--font-size':`${s.fontSize}px`,'--line-height':s.lineHeight,'--page-margin':`${margin}px`,'--paragraph-gap':`${s.paragraphGap}em`,'--indent':`${indentPx}px`,'--letter-spacing':`${s.letterSpacing}px`,'--text-align':s.align,'--hyphens':s.hyphens?'auto':'none'};
 element.style.setProperty('padding-top',`${topClearance}px`);
 element.style.setProperty('padding-bottom',`${bottomClearance}px`);
 for(const [name,value] of Object.entries(variables))element.style.setProperty(name,String(value));
 element.dataset.font=s.font;
}
// A tiny font sample also detects a changed fallback font or layout stylesheet.
export function typographyEnvironment(settings,width){
 const probe=document.createElement('div');probe.className='book-text measure';
 probe.style.width=`${width}px`;probe.style.height='auto';applyTypography(probe,settings,width);
 const sample=document.createElement('span');sample.style.whiteSpace='nowrap';sample.textContent='Ширина строки Aa 0123456789';probe.append(sample);document.body.append(probe);
 try{
  const style=getComputedStyle(probe);
  return JSON.stringify([navigator.userAgent,devicePixelRatio,sample.getBoundingClientRect().width,
   ...['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','wordSpacing','paddingTop','paddingBottom','paddingLeft','paddingRight','boxSizing','textIndent','textAlign','hyphens','overflowWrap'].map(key=>style[key])]);
 }finally{probe.remove();}
}
