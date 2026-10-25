import {presentationClasses} from './book-presentation.js';

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
function typesetHTML(block,settings,width,font){
 const root=document.createElement('div');root.innerHTML=block.html;
 if(block.type==='verse'||['verse','preformatted'].includes(block.presentation?.role))return {html:block.html,groups:[]};
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let node;
 while(node=walker.nextNode())if(!node.parentElement.closest('code,pre'))nodes.push(node);
 const canvas=document.createElement('canvas').getContext('2d');if(canvas)canvas.font=font;
 const budget=Math.max(0,width-settings.margin*2)*.65;
 const patterns=[/(?:^|[\s«(])((?:[ВвКкСсУуОоИиАа]|[Нн]а|[Нн]е|[Пп]о|[Оо]т|[Дд]о|[Ии]з|[Зз]а|[Нн]о) [\p{L}][\p{L}-]{0,9})(?![\p{L}-])/gu,/[А-ЯЁ]\. (?:[А-ЯЁ]\. )?[А-ЯЁ][а-яё]{1,12}/gu,/\d{1,4}(?:[.,]\d{1,2})? (?:кг|км|см|мм|мл|руб\.|г|м|л|%|₽)(?!\p{L})/gu];
 for(const textNode of nodes){
  const text=textNode.nodeValue,candidates=[];
  for(const pattern of patterns)for(const match of text.matchAll(pattern)){
   const value=match[1]||match[0],start=match.index+match[0].length-value.length;
   const measured=canvas?canvas.measureText(value).width:settings.fontSize*value.length;
   if(measured+Math.max(0,settings.letterSpacing)*(value.length-1)<=budget)candidates.push({start,end:start+value.length});
  }
  candidates.sort((a,b)=>a.start-b.start||b.end-a.end);let at=0;const fragment=document.createDocumentFragment();
  for(const group of candidates){if(group.start<at)continue;fragment.append(document.createTextNode(text.slice(at,group.start)));const span=document.createElement('span');span.className='book-glue';span.textContent=text.slice(group.start,group.end);fragment.append(span);at=group.end;}
  if(at){fragment.append(document.createTextNode(text.slice(at)));textNode.replaceWith(fragment);}
 }
 const groups=[...root.querySelectorAll('.book-glue')].map(el=>{const r=document.createRange();r.selectNodeContents(root);r.setEndBefore(el);const start=r.toString().length;return {start,end:start+el.textContent.length};});
 return {html:root.innerHTML,groups};
}
function lineBoxes(element){
 const range=document.createRange();range.selectNodeContents(element);const lines=[];
 for(const rect of range.getClientRects()){
  if(rect.width<=.1||rect.height<=.1)continue;
  const existing=lines.find(line=>Math.abs(line.top-rect.top)<2);
  if(existing)existing.bottom=Math.max(existing.bottom,rect.bottom);else lines.push({top:rect.top,bottom:rect.bottom});
 }
 return lines.sort((a,b)=>a.top-b.top);
}
function lineStart(element,top){
 const nodes=[],walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node,total=0;
 while(node=walker.nextNode()){nodes.push({node,start:total,end:total+node.length});total+=node.length;}
 let low=0,high=total;
 while(low<high){const mid=Math.floor((low+high)/2),part=nodes.find(n=>n.end>mid);if(!part)break;const r=document.createRange();r.setStart(part.node,mid-part.start);r.setEnd(part.node,mid-part.start+1);if(r.getBoundingClientRect().top>=top-2)high=mid;else low=mid+1;}
 return low;
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
 const measuredStyle=getComputedStyle(measure),contentHeight=height-parseFloat(measuredStyle.paddingTop)-parseFloat(measuredStyle.paddingBottom),prepared=new Map();
 const font=`${measuredStyle.fontStyle} ${measuredStyle.fontWeight} ${measuredStyle.fontSize} ${measuredStyle.fontFamily}`;
 const prepare=i=>{if(!prepared.has(i))prepared.set(i,typesetHTML(blocks[i],settings,width,font));return prepared.get(i);};
 const flush=()=>{if(parts.length){pages.push({html:parts.join(''),start,end});parts=[];start=null;measure.innerHTML='';}};
 const make=(b,i,from,to,reserve=0)=>`<${b.type==='h2'?'h2':b.type==='h3'?'h3':'div'} class="paragraph ${b.type==='verse'?'verse':''} ${presentationClasses(b.presentation)} ${from?'continued':''} ${to<b.text.length?'page-continues':''}" data-block="${i}" data-from="${from}" data-to="${to}"${reserve?` style="height:${Math.max(1,contentHeight-reserve)}px"`:''}>${sliceHTML(prepare(i).html,from,to)}</${b.type==='h2'?'h2':b.type==='h3'?'h3':'div'}>`;
 const fits=html=>{measure.innerHTML=parts.join('')+html;return measure.scrollHeight<=measure.clientHeight+1;};
 const cutAtWord=(text,cut,offset)=>{
  if(cut<text.length&&!/\s/.test(text[cut-1])&&!/\s/.test(text[cut])){const before=text.slice(offset,cut).search(/\s+\S*$/);if(before>0)cut=offset+before+text.slice(offset+before,cut).match(/^\s*/)[0].length;}
  if(cut>offset&&/[\uD800-\uDBFF]/.test(text[cut-1]))cut--;
  return cut;
 };
 const safeCut=(i,cut,offset)=>{const group=prepare(i).groups.find(g=>g.start<cut&&cut<g.end);return group&&group.start>offset?group.start:cut;};
 try{
  for(let i=0;i<blocks.length;i++){
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   const block=blocks[i],length=block.text.length;
   let offset=0,done=false;
   if(block.type==='h2'&&parts.length)flush();
   const next=blocks[i+1];
   if(!length&&/<img\b/.test(block.html)&&next?.presentation?.role==='caption'){
    const caption=make(next,i+1,0,next.text.length);measure.innerHTML=caption;
    const captionStyle=getComputedStyle(measure.lastElementChild),reserve=Math.ceil(measure.lastElementChild.getBoundingClientRect().height+parseFloat(captionStyle.marginTop)+parseFloat(captionStyle.marginBottom))+1;
    if(reserve<contentHeight*.4){
     const pair=make(block,i,0,0,reserve)+caption;if(!fits(pair)&&parts.length)flush();
     if(fits(pair)){start??={block:i,offset:0};parts.push(pair);end={block:i+1,offset:next.text.length};i++;continue;}
    }
   }
   if((block.type==='h3'||block.presentation?.role==='subtitle')&&parts.length&&next?.text.length&&!/<img|<table/.test(next.html)){
    measure.innerHTML=parts.join('')+make(block,i,0,length)+make(next,i+1,0,next.text.length);
    const lines=lineBoxes(measure.lastElementChild),needed=lines[Math.min(1,lines.length-1)];
    if(needed&&needed.bottom>measure.getBoundingClientRect().top+height-parseFloat(measuredStyle.paddingBottom)+1)flush();
   }
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
    let cut=safeCut(i,cutAtWord(block.text,low,offset),offset);
    if(cut<=offset)cut=low;
    if(block.type==='p'&&!['verse','preformatted'].includes(block.presentation?.role)&&!/<img|<table/.test(block.html)){
     measure.innerHTML=parts.join('')+make(block,i,offset,cut);
     const prefixLines=lineBoxes(measure.lastElementChild);
     if(prefixLines.length===1&&parts.length){flush();continue;}
     if(prefixLines.length>=3){
      const earlier=safeCut(i,cutAtWord(block.text,offset+lineStart(measure.lastElementChild,prefixLines.at(-1).top),offset),offset);
      measure.innerHTML=make(block,i,cut,length);
      if(lineBoxes(measure.lastElementChild).length===1&&earlier>offset){
       measure.innerHTML=make(block,i,offset,earlier);const first=lineBoxes(measure.lastElementChild).length;
       measure.innerHTML=make(block,i,earlier,length);if(first>=2&&lineBoxes(measure.lastElementChild).length>=2)cut=earlier;
      }
     }
    }
    const fragment=make(block,i,offset,cut);start??={block:i,offset};parts.push(fragment);end={block:i,offset:cut};offset=cut;flush();
    if(pages.length>2000)throw new Error('Слишком много страниц для черновой версии. Уменьшите шрифт. Текст не усечён.');
   }
   if(i%12===0){onProgress?.(Math.round(i/blocks.length*100));await new Promise(r=>setTimeout(r,0));}
  }
  flush();return pages;
 }finally{measure.remove();}
}
