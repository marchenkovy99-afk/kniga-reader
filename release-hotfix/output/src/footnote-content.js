// Resolve a linked note by its document anchor, never by searching its number.
// Some publishers put the anchor in a number-only heading before the body.
const tag=node=>(node?.localName||'').toLowerCase();
const children=node=>Array.from(node?.children||[]);
const descendants=node=>[node,...Array.from(node?.querySelectorAll?.('*')||[])];
const key=node=>node?.getAttribute?.('id')||node?.getAttribute?.('name')||'';
const marker=text=>String(text||'').replace(/[\s[\](){}.,:;]+/g,'');
const numeric=text=>/^[\d*†‡]+$/.test(marker(text));
const family=id=>/\d/.test(id)?id.replace(/\d+/g,'#'):null;
const heading=node=>/^h[1-6]$/.test(tag(node))||tag(node)==='title';
const semantic=node=>{
 const type=node?.getAttribute?.('epub:type')||node?.getAttributeNS?.('http://www.idpf.org/2007/ops','type')||'';
 return /(?:^|\s)(?:footnote|endnote)(?:\s|$)/.test(type)||['doc-footnote','doc-endnote'].includes(node?.getAttribute?.('role'));
};
function plainText(nodes,label){
 let meaningful=false;
 const walk=node=>{
  if(node.nodeType===3||node.nodeType===4){
   const value=(node.nodeValue||'').replace(/[\t\r\n ]+/g,' ');
   if(!meaningful&&marker(value)===label)return '';
   if(value.trim())meaningful=true;
   return value;
  }
  if(node.nodeType!==1)return '';
  const name=tag(node);
  if(['script','style','iframe','object','noscript'].includes(name))return '';
  if(name==='br')return '\n';
  const text=Array.from(node.childNodes).map(walk).join('');
  return ['p','div','section','aside','li','dt','dd','title','tr','blockquote'].includes(name)||heading(node)?'\n\n'+text+'\n\n':text;
 };
 return nodes.map(walk).join('').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim()||null;
}
export function readFootnote(doc,id,{label='',targetIds=[]}={}){
 const node=doc.getElementById(id)||Array.from(doc.getElementsByTagName('*')).find(el=>el.getAttribute('name')===id);
 if(!node)return null;
 const selected=marker(label)||marker(node.textContent);
 const linked=new Set(targetIds),pattern=family(id);
 const otherTarget=element=>descendants(element).some(el=>{
  const value=key(el);return value&&value!==id&&(linked.has(value)||(pattern&&family(value)===pattern));
 });
 // Explicit note containers establish the complete extent, including all paragraphs.
 for(let current=node;current&& !['body','html','fictionbook'].includes(tag(current));current=current.parentElement){
  if(semantic(current)||tag(current)==='li'||
    (['aside','section','div'].includes(tag(current))&&key(current)===id&&!otherTarget(current)))return plainText([current],selected);
  if(tag(current)==='section'&&doc.documentElement.localName==='FictionBook'&&
    !children(current).some(el=>tag(el)==='section')&&!otherTarget(current))return plainText([current],selected);
 }
 // Find the marker's paragraph/heading rather than accepting the marker itself.
 let start=node;
 for(let parent=node.parentElement;parent&&!['body','html','fictionbook'].includes(tag(parent));parent=parent.parentElement){
  if(['p','dt','dd'].includes(tag(parent))||heading(parent)){start=parent;break}
 }
 // A title wrapper can itself contain only the number, with the body after it.
 while(start.parentElement&&!['body','html','fictionbook'].includes(tag(start.parentElement))&&
   !start.nextSibling&&marker(start.parentElement.textContent)===selected)start=start.parentElement;
 const nodes=[start];
 for(let next=start.nextSibling;next;next=next.nextSibling){
  if(next.nodeType===1){
   if(otherTarget(next)||['hr','nav','footer'].includes(tag(next))||semantic(next))break;
   if(heading(next)&&marker(next.textContent)!==selected)break;
   if(numeric(next.textContent)&&marker(next.textContent)!==selected&&key(next))break;
  }
  nodes.push(next);
 }
 const text=plainText(nodes,selected);
 // Returning just a reference marker is an error, not a successfully opened note.
 return text&&marker(text)!==selected?text:null;
}
