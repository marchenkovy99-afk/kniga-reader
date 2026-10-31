import type { Block, Chapter, ParsedFB2 } from './domain';

const xmlText=(node:Element|null|undefined)=>node?.textContent?.replace(/\s+/g,' ').trim()||'';
const child=(node:Element,name:string)=>Array.from(node.children).find(e=>e.localName===name);
const children=(node:Element,name:string)=>Array.from(node.children).filter(e=>e.localName===name);
const href=(node:Element)=>node.getAttribute('l:href')||node.getAttribute('xlink:href')||node.getAttribute('href')||'';


const escapeHTML=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
type InlinePiece={html:string;text:string}|{image:Element};
/** Only known FB2 text markup is serialized; file-supplied tags, styles and scripts are never copied. */
function inlinePieces(node:Node):InlinePiece[]{
 if(node.nodeType===Node.TEXT_NODE){
  const text=(node.textContent||'').replace(/\s+/g,' ');
  return text?[{text,html:escapeHTML(text)}]:[];
 }
 if(node.nodeType!==Node.ELEMENT_NODE)return [];
 const element=node as Element,tag=element.localName.toLowerCase();
 if(tag==='image')return [{image:element}];
 const parts=Array.from(element.childNodes).flatMap(inlinePieces);
 const allowed:Record<string,string>={emphasis:'em',i:'em',strong:'strong',b:'strong',
  strikethrough:'s',sub:'sub',sup:'sup',code:'code',cite:'cite'};
 const wrapper=tag==='a'&&href(element).startsWith('#')?'sup':allowed[tag];
 return parts.map(piece=>{
  if('image' in piece||!wrapper)return piece;
  const cls=tag==='a'?' class="book-note-reference"':'';
  return {text:piece.text,html:`<${wrapper}${cls}>${piece.html}</${wrapper}>`};
 });
}
function addRichText(element:Element,kind:'paragraph'|'heading'|'verse',target:Block[],images:Map<string,string>){
 const pieces=Array.from(element.childNodes).flatMap(inlinePieces);
 let html='',text='';
 const flush=()=>{
  const normalized=text.replace(/\s+/g,' ').trim();
  if(normalized)target.push({kind,text:normalized,html:html.trim()});
  html='';text='';
 };
 for(const piece of pieces){
  if('image' in piece){
   flush();
   const ref=href(piece.image).replace(/^#/,'');
   const src=images.get(ref)||'';
   target.push({kind:'image',src,alt:src?'':'Изображение '+(ref||'без идентификатора')+' отсутствует в файле'});
  }else{html+=piece.html;text+=piece.text;}
 }
 flush();
}

export function parseFB2(xml:string):ParsedFB2{
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror'))throw new Error('FB2 содержит ошибку XML');
  const root=doc.documentElement;
  if(root.localName!=='FictionBook')throw new Error('Файл не является FB2');
  const description=Array.from(root.children).find(e=>e.localName==='description');
  const titleInfo=description&&child(description,'title-info');
  const bookTitle=titleInfo?xmlText(child(titleInfo,'book-title')):'';
  const authorNode=titleInfo&&child(titleInfo,'author');
  const author=authorNode?
    [child(authorNode,'first-name'),child(authorNode,'middle-name'),child(authorNode,'last-name')].map(xmlText).filter(Boolean).join(' '):'';
  const images=new Map<string,string>();
  for(const binary of Array.from(root.getElementsByTagName('*')).filter(e=>e.localName==='binary')){
    const id=binary.getAttribute('id'), mime=binary.getAttribute('content-type')||'image/jpeg';
    const contents=(binary.textContent||'').replace(/\s/g,'');
    if(id&&/^image\/(jpeg|png|webp|gif|svg\+xml)$/i.test(mime)&&contents.length<20_000_000&&/^[\w+/]*={0,2}$/.test(contents)){
      images.set(id,'data:'+mime+';base64,'+contents);
    }
  }
  const coverNode=titleInfo&&child(titleInfo,'coverpage');
  const coverImage=coverNode&&Array.from(coverNode.children).find(e=>e.localName==='image');
  const cover=coverImage?images.get(href(coverImage).replace(/^#/,'')):undefined;

  const blocks: Block[]=[];
  const chapters:Chapter[]=[];
  function walk(element:Element,target:Block[]){
    const tag=element.localName;
    if(tag==='image'){
      const ref=href(element).replace(/^#/,'');
      const src=images.get(ref)||'';
      target.push({kind:'image',src,alt:src?'':'Изображение '+(ref||'без идентификатора')+' отсутствует в файле'});
      return;
    }
    if(tag==='table'){
      const rows=Array.from(element.children).filter(e=>e.localName==='tr').map(row=>
        Array.from(row.children).filter(e=>e.localName==='td'||e.localName==='th').map(xmlText));
      target.push({kind:'table',rows});return;
    }
    if(tag==='p'||tag==='v'||tag==='subtitle'||tag==='text-author'){
      const kind=tag==='v'?'verse':tag==='subtitle'?'heading':'paragraph';
      addRichText(element,kind,target,images);return;
    }
    if(tag==='title'){
      const title=xmlText(element);if(title)target.push({kind:'heading',text:title});return;
    }
    for(const next of Array.from(element.children))walk(next,target);
    // Keep plain text in unusual FB2 elements that have no children.
    if(element.children.length===0&&xmlText(element)&&!['empty-line','image'].includes(tag))target.push({kind:'paragraph',text:xmlText(element)});
  }
  function sectionToChapter(section:Element, prefix:string):void{
    const sectionTitle=xmlText(child(section,'title'))||prefix;
    // A section title is visible book content, not merely an entry in the TOC.
    const material:Block[]=child(section,'title')?[{kind:'heading',text:sectionTitle}]:[];
    for(const element of Array.from(section.children)){
      if(element.localName==='title')continue;
      if(element.localName==='section'){
        if(material.length)chapters.push({id:'chapter-'+chapters.length,title:sectionTitle,blocks:material.splice(0)});
        sectionToChapter(element,sectionTitle);
      }else walk(element,material);
    }
    if(material.length)chapters.push({id:'chapter-'+chapters.length,title:sectionTitle,blocks:material});
  }
  const bodies=Array.from(root.children).filter(e=>e.localName==='body');
  for(const [index,body] of bodies.entries()){
    const sections=children(body,'section');
    const sectionTitle=index===0?(bookTitle||'Книга'):(body.getAttribute('name')||'Примечания');
    if(sections.length){
      const preamble:Block[]=[];
      for(const element of Array.from(body.children)){
        if(element.localName==='section'){
          if(preamble.length)chapters.push({id:'chapter-'+chapters.length,title:sectionTitle,blocks:preamble.splice(0)});
          sectionToChapter(element,sectionTitle);
        }else walk(element,preamble);
      }
      if(preamble.length)chapters.push({id:'chapter-'+chapters.length,title:sectionTitle,blocks:preamble});
    }else{
      const content:Block[]=[];for(const el of Array.from(body.children))walk(el,content);
      if(content.length)chapters.push({id:'chapter-'+chapters.length,title:sectionTitle,blocks:content});
    }
  }
  if(chapters.length===0)throw new Error('В FB2 не найден текст книги');
  for(const chapter of chapters)blocks.push(...chapter.blocks);
  return {title:bookTitle||'Без названия',author:author||'Автор не указан',cover,chapters,
    fullText:blocks.map(b=>b.kind==='image'?'':b.kind==='table'?b.rows.flat().join(' '):b.text).join('\n')};
}
