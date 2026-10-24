/** Character-based DOM ranges retain inline markup while typography repaginates. */
function sliceHTML(html,from,to){
 const root=document.createElement('div');root.innerHTML=html;
 if(from===0&&to===root.textContent.length)return html;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n,pos=0;const nodes=[];
 while((n=walker.nextNode())){nodes.push({node:n,start:pos,end:pos+n.length});pos+=n.length;}
 if(!nodes.length)return html;
 const boundary=(offset,end)=>{
  if(offset===0)return [root,0];
  if(offset>=pos)return [root,root.childNodes.length];
  const point=nodes.find(x=>end?x.end>=offset:x.end>offset)||nodes.at(-1);
  return [point.node,offset-point.start];
 };
 const range=document.createRange();range.setStart(...boundary(from,false));range.setEnd(...boundary(to,true));
 const output=document.createElement('div');output.append(range.cloneContents());return output.innerHTML;
}
export function applyTypography(element,s,width){
 const margin=Math.min(s.margin,Math.max(8,(width-150)/2));
 const variables={'--font-size':`${s.fontSize}px`,'--line-height':s.lineHeight,'--page-margin':`${margin}px`,'--paragraph-gap':`${s.paragraphGap}em`,'--indent':`${s.indent}em`,'--letter-spacing':`${s.letterSpacing}px`,'--text-align':s.align,'--hyphens':s.hyphens?'auto':'none'};
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
export async function paginate(blocks,{width,height,settings,signal,onProgress}){
 const measure=document.createElement('div');measure.className='book-text measure';
 measure.style.width=`${width}px`;measure.style.height=`${height}px`;applyTypography(measure,settings,width);
 document.body.append(measure);
 const pages=[];let parts=[],start=null,end=null;
 const flush=()=>{if(parts.length){pages.push({html:parts.join(''),start,end});parts=[];start=null;measure.innerHTML='';}};
 const make=(b,i,from,to)=>`<${b.type==='h2'?'h2':b.type==='h3'?'h3':'div'} class="paragraph ${b.type==='verse'?'verse':''} ${from?'continued':''}" data-block="${i}" data-from="${from}" data-to="${to}">${sliceHTML(b.html,from,to)}</${b.type==='h2'?'h2':b.type==='h3'?'h3':'div'}>`;
 const fits=html=>{measure.innerHTML=parts.join('')+html;return measure.scrollHeight<=measure.clientHeight+1;};
 try{
  for(let i=0;i<blocks.length;i++){
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   const block=blocks[i],length=block.text.length;
   let offset=0,done=false;
   if(block.type==='h2'&&parts.length)flush();
   while(!done){
    const whole=make(block,i,offset,length);
    if(fits(whole)){start??={block:i,offset};parts.push(whole);end={block:i,offset:length};done=true;continue;}
    // Images and tables remain indivisible. Scale images in CSS; never truncate a table.
    if(!length||/<table\b/.test(block.html)){
     if(parts.length){flush();continue;}
     throw new Error('Этот блок не помещается на странице. Уменьшите шрифт или поля. Исходная книга сохранена.');
    }
    let low=offset,high=length;
    while(low<high){const mid=Math.ceil((low+high)/2);if(fits(make(block,i,offset,mid)))low=mid;else high=mid-1;}
    if(low===offset){if(parts.length){flush();continue;}throw new Error('Текст не помещается. Уменьшите размер шрифта или поля.');}
    let cut=low;
    // Prefer a word boundary but allow an exceptionally long word to wrap anywhere.
    if(low<length&&!/\s/.test(block.text[low-1])&&!/\s/.test(block.text[low])){
     const before=block.text.slice(offset,low).search(/\s+\S*$/);
     if(before>0)cut=offset+before+block.text.slice(offset+before,low).match(/^\s*/)[0].length;
    }
    // Do not split UTF-16 surrogate pairs.
    if(cut>offset&&/[\uD800-\uDBFF]/.test(block.text[cut-1]))cut--;
    if(cut<=offset)cut=low;
    const fragment=make(block,i,offset,cut);start??={block:i,offset};parts.push(fragment);end={block:i,offset:cut};offset=cut;flush();
    if(pages.length>2000)throw new Error('Слишком много страниц для черновой версии. Уменьшите шрифт. Текст не усечён.');
   }
   if(i%12===0){onProgress?.(Math.round(i/blocks.length*100));await new Promise(r=>setTimeout(r,0));}
  }
  flush();return pages;
 }finally{measure.remove();}
}
