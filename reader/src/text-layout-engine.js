import {applyTypography} from './typography.js';
import {visibleContentFits} from './pagination-geometry.js';

export function checkCancelled(signal){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');}
/** Exact production CSS and DOM. Canvas is never used for line breaking. */
export function createTextLayoutEngine({width,height,settings,renderer,doc=document}){
 if(!(width>0&&height>0))throw Error('Область чтения недоступна.');
 const measure=doc.createElement('div');measure.className='book-text measure';measure.lang='ru';measure.dataset.engine='dom';
 Object.assign(measure.style,{width:`${width}px`,height:`${height}px`,overflow:'visible'});
 applyTypography(measure,settings,width);doc.body.append(measure);
 function place(fragments){measure.replaceChildren(...fragments.map(renderer.fragment));return measure;}
 function fits(fragments){place(fragments);return visibleContentFits(measure);}
 function geometry(){
  const range=doc.createRange();range.selectNodeContents(measure);
  const rects=[...range.getClientRects()].filter(r=>r.height>0&&r.width>0),bounds=measure.getBoundingClientRect();
  const bottom=rects.length?Math.max(...rects.map(r=>r.bottom)):bounds.top;
  const style=doc.defaultView.getComputedStyle(measure);
  return {first:rects.length?Math.min(...rects.map(r=>r.top))-bounds.top:0,last:bottom-bounds.top,freeSpace:bounds.bottom-bottom,lineHeight:parseFloat(style.lineHeight),width,height};
 }
 async function ready(signal){
  checkCancelled(signal);await doc.fonts?.ready;checkCancelled(signal);
  const images=[...measure.querySelectorAll('img')];
  await Promise.all(images.map(img=>img.decode?.().catch(()=>{})||Promise.resolve()));checkCancelled(signal);
 }
 return {measure,place,fits,geometry,ready,destroy:()=>measure.remove()};
}
