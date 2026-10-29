import {presentationClasses} from './book-presentation.js';

/** Materialize only original source ranges. No layout decision belongs here. */
export function createPageRenderer(model,doc=document){
 const roots=new Map();
 function source(index){
  if(!roots.has(index)){
   const root=doc.createElement('div');root.innerHTML=model.blocks[index].html;
   if(root.textContent!==model.blocks[index].text)throw Error('Содержимое блока отличается от исходного текста. Исходный файл сохранён.');
   const nodes=[],walker=doc.createTreeWalker(root,4);let node,offset=0;
   while(node=walker.nextNode()){nodes.push({node,start:offset,end:offset+node.length});offset+=node.length;}
   roots.set(index,{root,nodes,length:offset});
  }
  return roots.get(index);
 }
 function slice(index,from,to){
  const {root,nodes,length}=source(index);
  if(from===0&&to===length)return root.innerHTML;
  if(from===to)return '';
  const boundary=offset=>{
   if(offset===0)return [root,0];
   if(offset===length)return [root,root.childNodes.length];
   let low=0,high=nodes.length-1;
   // The same boundary is used for both adjacent slices. Zero-text siblings
   // such as BRs between text nodes therefore belong to the previous slice.
   while(low<high){const mid=Math.floor((low+high)/2);if(nodes[mid].end>offset)high=mid;else low=mid+1;}
   return [nodes[low].node,offset-nodes[low].start];
  };
  const range=doc.createRange();range.setStart(...boundary(from));range.setEnd(...boundary(to));
  const output=doc.createElement('div');output.append(range.cloneContents());return output.innerHTML;
 }
 function fragment(part){
  const block=model.blocks[part.block],tag=['h2','h3'].includes(block.type)?block.type:'div';
  const el=doc.createElement(tag);el.className=`paragraph ${block.type==='verse'?'verse':''} ${presentationClasses(block.presentation)} ${part.from?'continued':''} ${part.to<block.text.length?'page-continues':''} ${block.text.length&&/<img\b/i.test(block.html)?'book-inline-illustration':''}`;
  el.dataset.block=String(part.block);el.dataset.from=String(part.from);el.dataset.to=String(part.to);
  el.dataset.blockId=block.id;
  if(part.reserveHeight)el.style.height=`${part.reserveHeight}px`;
  el.innerHTML=slice(part.block,part.from,part.to);
  if(part.hyphen){const marker=doc.createElement('span');marker.className='book-page-hyphen';marker.setAttribute('aria-hidden','true');el.append(marker);}
  return el;
 }
 return {fragment,html:page=>page.fragments.map(part=>fragment(part).outerHTML).join(''),clear:()=>roots.clear()};
}
