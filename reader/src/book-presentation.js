// Source CSS is interpreted as a small presentation vocabulary, never executed.
const name=node=>(node?.localName||node?.nodeName||'').split(':').at(-1).toLowerCase();
export const PRESENTATION_VERSION=1;
export function declarations(css=''){
 const out={};
 for(const item of css.split(';')){
  const colon=item.indexOf(':');if(colon<0)continue;
  const key=item.slice(0,colon).trim().toLowerCase(),value=item.slice(colon+1).replace(/!important\s*$/i,'').trim().toLowerCase();
  if(key==='text-align'&&['left','right','center','justify'].includes(value))out.align=value;
  if(key==='font-style'&&['normal','italic','oblique'].includes(value))out.italic=value!=='normal';
  if(key==='font-weight'&&/^(normal|bold|[1-9]00)$/.test(value))out.bold=value==='bold'||Number(value)>=600;
  if(key==='text-decoration'&&/^(none|underline|line-through)$/.test(value))out.decoration=value;
 }
 return out;
}
function compound(node,selector){
 if(node?.nodeType!==1)return false;
 const parts=selector.match(/^[\w*-]+|[.#][\w-]+/g);
 if(!parts||parts.join('')!==selector)return false;
 return parts.every(part=>part[0]==='.'?(node.getAttribute('class')||'').split(/\s+/).includes(part.slice(1)):part[0]==='#'?node.getAttribute('id')===part.slice(1):part==='*'||name(node)===part.toLowerCase());
}
function matches(node,selector){
 const parts=selector.trim().split(/\s+/);let current=node;
 if(!compound(current,parts.pop()))return false;
 while(parts.length){const part=parts.pop();current=current.parentNode;while(current&&!compound(current,part))current=current.parentNode;if(!current)return false;}
 return true;
}
function* styleRules(css){
 let cursor=0;
 while(cursor<css.length){
  const start=cursor;let quote='',parentheses=0,token='';
  for(;cursor<css.length;cursor++){
   const char=css[cursor];
   if(char==='\\'){cursor++;continue;}
   if(quote){if(char===quote)quote='';continue;}
   if(char==='"'||char==="'"){quote=char;continue;}
   if(char==='(')parentheses++;else if(char===')')parentheses=Math.max(0,parentheses-1);
   if(!parentheses&&(char===';'||char==='{')){token=char;break;}
  }
  if(!token)return;
  const selector=css.slice(start,cursor).trim();cursor++;
  if(token===';')continue; // Ignore @charset/@import statements; never fetch them.
  const body=cursor;let depth=1;quote='';
  for(;cursor<css.length;cursor++){
   const char=css[cursor];if(char==='\\'){cursor++;continue;}
   if(quote){if(char===quote)quote='';continue;}
   if(char==='"'||char==="'"){quote=char;continue;}
   if(char==='{')depth++;else if(char==='}'&&!--depth)break;
  }
  if(depth)return;
  // Conditional/nested rules are deliberately unsupported, not made unconditional.
  if(!selector.startsWith('@'))yield {selector,body:css.slice(body,cursor)};
  cursor++;
 }
}
export function sourceStyles(sources=[]){
 const rules=[];let order=0;
 for(const source of sources){
  const css=source.slice(0,200000).replace(/\/\*[\s\S]*?\*\//g,'');
  for(const rule of styleRules(css)){
   const values=declarations(rule.body);
   if(!Object.keys(values).length)continue;
   for(const selector of rule.selector.split(',').map(s=>s.trim())){
    if(rules.length>=2000||selector.length>120||!/^[\w.*#\s-]+$/.test(selector))continue;
    const score=(selector.match(/#/g)||[]).length*100+(selector.match(/\./g)||[]).length*10+(selector.match(/(?:^|\s)[a-z]/gi)||[]).length;
    rules.push({selector,values,score,order:order++});
   }
  }
 }
 rules.sort((a,b)=>a.score-b.score||a.order-b.order);
 const cache=new WeakMap();
 return node=>{
  if(!node||node.nodeType!==1)return {};
  if(cache.has(node))return cache.get(node);
  const out={};for(const rule of rules)if(matches(node,rule.selector))Object.assign(out,rule.values);
  Object.assign(out,declarations(node.getAttribute('style')||''));cache.set(node,out);return out;
 };
}
const roles={epigraph:'epigraph',dedication:'epigraph',cite:'quote',blockquote:'quote',quote:'quote',quotation:'quote',poem:'verse',stanza:'verse',verse:'verse',v:'verse','text-author':'attribution',attribution:'attribution',signature:'attribution',figcaption:'caption',caption:'caption','image-caption':'caption',subtitle:'subtitle',pre:'preformatted'};
export function blockPresentation(node,style=()=>({})){
 const chain=[];for(let n=node;n?.nodeType===1;n=n.parentNode)chain.unshift(n);
 const out={};
 for(const n of chain){
  const tokens=[name(n),...(n.getAttribute('class')||'').toLowerCase().split(/\s+/),...(n.getAttribute('epub:type')||'').toLowerCase().split(/\s+/).map(s=>s.split(':').at(-1))];
  const role=tokens.map(t=>roles[t]).find(Boolean);if(role)out.role=role;
  Object.assign(out,style(n));
 }
 // Prose follows the user's alignment. Only semantic inserts retain source alignment.
 if(!out.role&&!/^h[1-6]$/.test(name(node))&&name(node)!=='title')delete out.align;
 return out;
}
export function presentationClasses(p={}){
 const classes=[];
 if(Object.values(roles).includes(p.role))classes.push('book-'+p.role);
 if(['center','right','left','justify'].includes(p.align))classes.push('book-align-'+p.align);
 if(typeof p.italic==='boolean')classes.push(p.italic?'book-italic':'book-roman');
 if(typeof p.bold==='boolean')classes.push(p.bold?'book-bold':'book-regular');
 if(['underline','line-through'].includes(p.decoration))classes.push('book-'+p.decoration);
 return classes.join(' ');
}
