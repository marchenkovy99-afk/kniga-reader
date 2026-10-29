import type { Block, Chapter, ParsedFB2 } from './domain';

const xmlText=(node:Element|null|undefined)=>node?.textContent?.replace(/\s+/g,' ').trim()||'';
const child=(node:Element,name:string)=>Array.from(node.children).find(e=>e.localName===name);
const children=(node:Element,name:string)=>Array.from(node.children).filter(e=>e.localName===name);
const href=(node:Element)=>node.getAttribute('l:href')||node.getAttribute('xlink:href')||node.getAttribute('href')||'';

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
    if(id&&/^image\/(jpeg|png|webp|gif)$/i.test(mime)&&contents.length<20_000_000&&/^[\w+/]*={0,2}$/.test(contents)){
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
      const src=images.get(href(element).replace(/^#/,''));if(src)target.push({kind:'image',src,alt:''});
      return;
    }
    if(tag==='table'){
      const rows=Array.from(element.children).filter(e=>e.localName==='tr').map(row=>
        Array.from(row.children).filter(e=>e.localName==='td'||e.localName==='th').map(xmlText));
      target.push({kind:'table',rows});return;
    }
    if(tag==='p'||tag==='v'||tag==='subtitle'||tag==='text-author'){
      target.push({kind:tag==='v'?'verse':tag==='subtitle'?'heading':'paragraph',text:xmlText(element)});return;
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
    const material:Block[]=[];
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
