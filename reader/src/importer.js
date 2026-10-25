import { unzipSync } from 'fflate';
import {PRESENTATION_VERSION,sourceStyles,blockPresentation,presentationClasses} from './book-presentation.js';
const MAX_FILE=20*1024*1024, MAX_EXPANDED=60*1024*1024;
const elements=n=>Array.from(n.childNodes||[]).filter(x=>x.nodeType===1);
const tag=n=>(n.localName||n.nodeName||'').split(':').at(-1).toLowerCase();
const all=(n,t)=>Array.from(n.getElementsByTagName('*')).filter(x=>tag(x)===t);
const first=(n,t)=>all(n,t)[0];
const content=n=>n?.textContent?.trim()||'';
export const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function decode(bytes) {
 const head=new TextDecoder().decode(bytes.subarray(0,180));
 const encoding=head.match(/encoding\s*=\s*["']([^"']+)/i)?.[1];
 if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(bytes);
 try {return new TextDecoder(encoding||'utf-8',{fatal:true}).decode(bytes);} catch {return new TextDecoder('windows-1251').decode(bytes);}
}
function xml(text){
 const markup=text.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g,'');
 if(/<!DOCTYPE|<!ENTITY/i.test(markup)) throw new Error('DTD и DOCTYPE в книге не поддерживаются.');
 let doc;
 try {doc=new DOMParser({onError:()=>{throw new Error('XML');}}).parseFromString(text,'application/xml');}catch{throw new Error('XML книги повреждён. Проверьте файл.');}
 if(!doc.documentElement||first(doc,'parsererror')||tag(doc.documentElement)==='parsererror')throw new Error('XML книги повреждён. Проверьте файл.');
 return doc;
}
function epubSource(bytes){
 let source=decode(bytes);
 // Only a conventional declaration in the prolog is removed. Internal subsets
 // and entity definitions still reach xml()'s rejection; no DTD is ever resolved.
 source=source.replace(/^(\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*)<!DOCTYPE\s+html\b[^>]*>/i,(whole,prolog)=>{
  const declaration=whole.slice(prolog.length);
  return !/[\[\]]/.test(declaration)&&/^<!DOCTYPE\s+html(?:\s+PUBLIC\s+(?:"[^"]*"|'[^']*')\s+(?:"[^"]*"|'[^']*')|\s+SYSTEM\s+(?:"[^"]*"|'[^']*'))?\s*>$/i.test(declaration)?prolog:whole;
 });
 const entities={nbsp:160,ensp:8194,emsp:8195,thinsp:8201,ndash:8211,mdash:8212,hellip:8230,laquo:171,raquo:187,lsquo:8216,rsquo:8217,ldquo:8220,rdquo:8221,bull:8226,middot:183,copy:169,reg:174,trade:8482,euro:8364,shy:173};
 return source.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|&([A-Za-z][A-Za-z0-9]+);/g,(whole,name)=>entities[name]?`&#${entities[name]};`:whole);
}
function unzip(bytes){
 let total=0,count=0;
 try{return unzipSync(bytes,{filter:e=>{
  total+=e.originalSize;count++;
  if(total>MAX_EXPANDED||count>5000)throw new Error('Лимит распаковки 60 МБ или 5000 файлов превышен.');
  if(e.name.startsWith('/')||e.name.split('/').includes('..'))throw new Error('Небезопасный путь в архиве.');
  return true;
 }});}catch(e){throw new Error(/Лимит|Небезопасный/.test(e.message)?e.message:'Архив книги повреждён.');}
}
function path(base,relative){
 if(/^(?:[a-z][\w+.-]*:|\/\/|\/)/i.test(relative))return null;
 const stack=base.split('/').slice(0,-1);
 for(const p of relative.split('/')){if(p==='..'){if(!stack.length)return null;stack.pop();}else if(p&&p!=='.')stack.push(p);}
 return stack.join('/');
}
function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
const mimeFor=p=>({'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','gif':'image/gif','webp':'image/webp'}[p.split('.').at(-1)?.toLowerCase()]);
function imageData(bytes,mime){if(!bytes||!/^image\/(png|jpeg|gif|webp)$/.test(mime))return null;return `data:${mime};base64,${base64(bytes)}`;}
function convert(doc,root,ctx){
 const blocks=[];
 function safe(n){
  if(n.nodeType===3||n.nodeType===4){
   let pre=false;for(let p=n.parentNode;p?.nodeType===1;p=p.parentNode)if(tag(p)==='pre'){pre=true;break;}
   return escapeHTML(pre?n.nodeValue:n.nodeValue.replace(/[ \t\r\n]+/g,' '));
  }
  if(n.nodeType!==1)return '';
  const t=tag(n);
  if(['script','style','iframe','object','embed','form','input','button','audio','video','svg','math'].includes(t)){ctx.warnings.add('Исполняемые или неподдерживаемые элементы не отображаются.');return '';}
  const inner=()=>Array.from(n.childNodes).map(safe).join('');
  if(t==='image'||t==='img'){
   const ref=n.getAttribute('l:href')||n.getAttribute('xlink:href')||n.getAttribute('href')||n.getAttribute('src');
   const src=ctx.image(ref);
   if(!src){ctx.warnings.add('Часть изображений недоступна или имеет неподдерживаемый формат.');return '<span>[Изображение недоступно]</span>';}
   return `<img src="${src}" alt="${escapeHTML(n.getAttribute('alt')||'Иллюстрация')}" />`;
  }
  if(t==='a'){
   const href=n.getAttribute('l:href')||n.getAttribute('xlink:href')||n.getAttribute('href')||'';
   const id=ctx.link(href);
   return id?`<a href="#" data-note="${escapeHTML(id)}">${inner()}</a>`:inner();
  }
  if(['br','empty-line'].includes(t))return '<br/>';
  // FB2 stanza containers formerly flattened their lines into one paragraph.
  // BR retains the original text offsets while restoring the visual line breaks.
  if(t==='stanza')return elements(n).map(safe).join('<br/>');
  const mapped={emphasis:'em',strong:'strong',em:'em',b:'strong',i:'em',sup:'sup',sub:'sub',strikethrough:'s',s:'s',code:'code',u:'u',td:'td',th:'th',tr:'tr',tbody:'tbody',thead:'thead',table:'table',li:'li',ul:'ul',ol:'ol'}[t];
  const classes=presentationClasses(ctx.style?.(n));
  return mapped?`<${mapped}${classes?` class="${classes}"`:''}>${inner()}</${mapped}>`:classes?`<span class="${classes}">${inner()}</span>`:inner();
 }
 const add=(n,type,sourceId)=>{
  let html=tag(n)==='title'?elements(n).map(safe).join('<br/>'):Array.from(n.childNodes).map(safe).join('');
  if(['img','image','empty-line'].includes(tag(n)))html=safe(n);
  if(['table','ul','ol','stanza'].includes(tag(n)))html=safe(n);
  const text=xml(`<r>${html}</r>`).documentElement.textContent;
  if(!text.trim()&&!html.includes('<img')&&!html.includes('<br'))return;
  blocks.push({id:`b${ctx.index++}`,type,html,text,sourceId:sourceId||ctx.id(n.getAttribute('id')||'')||null,presentation:blockPresentation(n,ctx.style)});
 };
 function visit(n,sourceId=null){
  if(n.nodeType===3){if(n.nodeValue.trim())add(n.parentNode,'p',sourceId);return;}
  if(n.nodeType!==1)return;
  const t=tag(n), id=ctx.id(n.getAttribute('id')||'')||sourceId;
  if(['script','style','iframe','object','embed','svg','math'].includes(t)){safe(n);return;}
  if(t==='title'||/^h[1-6]$/.test(t)){add(n,/^h[3-6]$/.test(t)?'h3':'h2',id);return;}
  if(['p','v','subtitle','text-author','img','image','table','ul','ol','empty-line','pre'].includes(t)){add(n,t==='subtitle'?'h3':t==='v'?'verse':'p',id);return;}
  const hasBlock=elements(n).some(x=>['p','section','div','title','blockquote','poem','stanza','epigraph','cite','h1','h2','h3','h4','h5','h6','ul','ol','table','image','img','pre'].includes(tag(x)));
  if(!hasBlock&&n.textContent.trim()){add(n,'p',id);return;}
  let pending=id;
  for(const child of Array.from(n.childNodes)){if(child.nodeType===1){const before=blocks.length;visit(child,pending);if(blocks.length>before)pending=null;}else if(child.nodeType===3&&child.nodeValue.trim()){blocks.push({id:`b${ctx.index++}`,type:'p',html:escapeHTML(child.nodeValue),text:child.nodeValue,sourceId:pending});pending=null;}}
 }
 visit(root);
 return blocks;
}
function finish(book){
 if(!book.blocks.length)throw new Error('В файле не найден текст книги.');
 const chars=book.blocks.reduce((a,b)=>a+b.text.length,0);
 if(chars>2_000_000)throw new Error('В черновой версии поддерживаются книги до 2 млн символов. Файл не усечён.');
 const chapters=book.blocks.flatMap((b,i)=>['h2','h3'].includes(b.type)?[{title:b.text,block:i,level:b.type==='h3'?2:1}]:[]);
  return {...book,presentationVersion:PRESENTATION_VERSION,chapters:chapters.length?chapters:[{title:'Начало книги',block:0}],chars};
}
function fb2(bytes,name){
 const doc=xml(decode(bytes));
 if(tag(doc.documentElement)!=='fictionbook')throw new Error('Это не файл FictionBook (FB2).');
 const info=first(doc,'title-info'), bins=new Map(all(doc,'binary').map(x=>[x.getAttribute('id'),x]));
 const warnings=new Set();
 const image=ref=>{
  const node=bins.get((ref||'').replace(/^#/,''));if(!node)return null;
  const mime=node.getAttribute('content-type');if(!/^image\/(png|jpeg|gif|webp)$/.test(mime))return null;
  const data=node.textContent.replace(/\s/g,'');if(!/^[A-Za-z0-9+/]*={0,2}$/.test(data))return null;
  return `data:${mime};base64,${data}`;
 };
 const ctx={index:0,warnings,image,style:sourceStyles(),id:x=>x||null,link:x=>x.startsWith('#')?x.slice(1):null};
 const blocks=elements(doc.documentElement).filter(x=>tag(x)==='body').flatMap(x=>convert(doc,x,ctx));
 const authors=info?all(info,'author').map(x=>['first-name','middle-name','last-name'].map(t=>content(first(x,t))).filter(Boolean).join(' ')).filter(Boolean).join(', '):'';
 const cover=info?first(first(info,'coverpage')||info,'image'):null;
 return finish({title:content(info&&first(info,'book-title'))||name.replace(/\.fb2(?:\.zip)?$/i,''),author:authors||'Автор не указан',blocks,format:'FB2',warnings:[...warnings],cover:cover?image(cover.getAttribute('l:href')||cover.getAttribute('xlink:href')):null});
}
function epub(files,name){
 if(files['META-INF/encryption.xml'])throw new Error('EPUB с шифрованием или DRM пока не поддерживается.');
 const container=files['META-INF/container.xml'];if(!container)throw new Error('В EPUB отсутствует container.xml.');
 const opfPath=first(xml(decode(container)),'rootfile')?.getAttribute('full-path');
 if(!opfPath||!files[opfPath])throw new Error('В EPUB не найдено описание книги.');
 const opf=xml(decode(files[opfPath]));
 if(all(opf,'meta').some(x=>x.getAttribute('property')==='rendition:layout'&&content(x)==='pre-paginated'))throw new Error('EPUB с фиксированной вёрсткой пока не поддерживается.');
 const manifest=new Map(all(opf,'item').map(x=>[x.getAttribute('id'),x]));
 const spine=all(opf,'itemref');if(!spine.length)throw new Error('В EPUB нет порядка глав (spine).');
 const warnings=new Set(),blocks=[];
 let index=0;
 for(const entry of spine){
  const item=manifest.get(entry.getAttribute('idref'));const file=item&&path(opfPath,item.getAttribute('href'));
  if(!file||!files[file])throw new Error('Одна из глав EPUB отсутствует. Импорт отменён, чтобы не потерять текст.');
  if(!['application/xhtml+xml','text/html'].includes(item.getAttribute('media-type')))throw new Error('Одна из глав EPUB имеет неподдерживаемый формат.');
  const source=epubSource(files[file]);
  const doc=xml(source);const body=first(doc,'body');if(!body)throw new Error('Повреждена глава EPUB.');
  const localStyles=all(doc,'link').filter(n=>(n.getAttribute('rel')||'').split(/\s+/).includes('stylesheet')).flatMap(n=>{
   const ref=path(file,n.getAttribute('href')||'');return ref&&files[ref]?[decode(files[ref])]:[];
  });
  const style=sourceStyles([...localStyles,...all(doc,'style').map(n=>n.textContent)]);
  const ctx={index,warnings,style,id:x=>x?`${file}#${x}`:null,link:ref=>{
   if(!ref.includes('#'))return null;const [dest,id]=ref.split('#');const p=dest?path(file,dest):file;return p?`${p}#${id}`:null;
  },image:ref=>{const p=ref&&path(file,ref);return p?imageData(files[p],mimeFor(p)):null;}};
  const part=convert(doc,body,ctx);if(part[0]&&!part[0].sourceId)part[0].sourceId=`${file}#top`;
  blocks.push(...part);index=ctx.index;
 }
 const coverItem=[...manifest.values()].find(x=>(x.getAttribute('properties')||'').split(' ').includes('cover-image'));
 const cp=coverItem&&path(opfPath,coverItem.getAttribute('href'));
 return finish({title:content(first(opf,'title'))||name.replace(/\.epub$/i,''),author:content(first(opf,'creator'))||'Автор не указан',blocks,format:'EPUB',warnings:[...warnings],cover:cp?imageData(files[cp],mimeFor(cp)):null});
}
export async function importBook(input,name){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length>MAX_FILE)throw new Error('В черновой версии можно открыть файл до 20 МБ.');
 if(!bytes.length)throw new Error('Файл пуст.');
 if(/\.fb2$/i.test(name))return fb2(bytes,name);
 if(/\.(?:fb2\.zip|zip|fbz)$/i.test(name)){
  const files=unzip(bytes), entries=Object.keys(files).filter(x=>/\.fb2$/i.test(x));
  if(entries.length!==1)throw new Error('В архиве должен быть ровно один файл FB2.');
  return fb2(files[entries[0]],name);
 }
 if(/\.epub$/i.test(name))return epub(unzip(bytes),name);
 if(/\.txt$/i.test(name)){
  const blocks=decode(bytes).replace(/\r\n?/g,'\n').split(/\n[ \t]*\n/).filter(x=>x.trim()).map((text,i)=>({id:`b${i}`,type:'p',text,html:escapeHTML(text).replace(/\n/g,'<br/>'),sourceId:null}));
  return finish({title:name.replace(/\.txt$/i,''),author:'Текстовый файл',blocks,format:'TXT',warnings:[],cover:null});
 }
 throw new Error('Этот формат пока не поддерживается. Выберите FB2, FB2.zip, EPUB или TXT.');
}
