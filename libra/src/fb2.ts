import type { Block, Chapter, ParsedFB2, InlineRun, TextBlock } from './domain';

const xmlText=(node:Element|null|undefined)=>node?.textContent?.replace(/\s+/g,' ').trim()||'';
const child=(node:Element,name:string)=>Array.from(node.children).find(e=>e.localName===name);
const children=(node:Element,name:string)=>Array.from(node.children).filter(e=>e.localName===name);
const href=(node:Element)=>node.getAttributeNS('http://www.w3.org/1999/xlink','href')||node.getAttribute('l:href')||node.getAttribute('xlink:href')||node.getAttribute('href')||'';

function normalizedRuns(raw:InlineRun[]):InlineRun[]{
 const runs:InlineRun[]=[];let space:InlineRun|undefined;
 const append=(text:string,marks:InlineRun)=>{
  const {text:_,...flags}=marks,last=runs[runs.length-1];
  if(last&&last.strong===flags.strong&&last.emphasis===flags.emphasis&&last.strike===flags.strike&&last.sup===flags.sup&&last.sub===flags.sub&&last.note===flags.note)last.text+=text;
  else runs.push({...flags,text});
 };
 for(const run of raw)for(const character of run.text){
  if(/\s/.test(character)){if(runs.length)space=run;continue;}
  if(space){append(' ',space);space=undefined;}
  append(character,run);
 }
 return runs;
}

export function parseFB2(xml:string):ParsedFB2{
  const markup=xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g,'');
  if(/<!DOCTYPE|<!ENTITY/i.test(markup))throw new Error('DTD и DOCTYPE в FB2 не поддерживаются');
  if(xml.length>50*1024*1024)throw new Error('FB2 превышает лимит 50 МБ');
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
  const notes:Record<string,string>=Object.create(null);
  for(const body of Array.from(root.children).filter(e=>e.localName==='body'&&e.getAttribute('name'))){
    for(const section of Array.from(body.getElementsByTagName('*')).filter(e=>e.localName==='section'&&e.id)){
      notes[section.id]=Array.from(section.children).map(xmlText).filter(Boolean).join('\n');
    }
  }
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
    if(tag==='p'||tag==='v'||tag==='subtitle'||tag==='text-author'||tag==='li'||tag==='title'){
      const kind=tag==='v'?'verse':tag==='subtitle'||tag==='title'?'heading':'paragraph';
      // Inline pictures must survive. Split around image nodes, preserving the
      // complete sequence of text segments and illustrations.
      let buffer:InlineRun[]=[];
      const hasPicture=Array.from(element.getElementsByTagName('*')).some(el=>el.localName==='image');
      const flush=(keepEmpty=false)=>{
        const inline=normalizedRuns(buffer),text=inline.map(run=>run.text).join('');
        if(text||keepEmpty)target.push({kind,text,...(inline.some(run=>Object.keys(run).length>1)?{inline}:{}),...(tag==='li'?{listItem:true}:{})} satisfies TextBlock);
        buffer=[];
      };
      const visit=(node:Node,marks:Omit<InlineRun,'text'>={}):void=>{
        if(node.nodeType===Node.TEXT_NODE){buffer.push({...marks,text:node.textContent||''});return;}
        if(node.nodeType!==Node.ELEMENT_NODE)return;
        const nested=node as Element;
        if(nested.localName==='image'){flush();walk(nested,target);return;}
        const name=nested.localName;
        const next={...marks};
        if(name==='strong'||name==='b')next.strong=true;
        if(name==='emphasis'||name==='em'||name==='i')next.emphasis=true;
        if(name==='strikethrough')next.strike=true;
        if(name==='sup')next.sup=true;
        if(name==='sub')next.sub=true;
        const link=href(nested);
        if(name==='a'&&link.startsWith('#'))next.note=link.slice(1);
        for(const child of Array.from(node.childNodes))visit(child,next);
      };
      for(const node of Array.from(element.childNodes))visit(node);
      flush(!hasPicture&&tag!=='title');return;
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
    const material:Block[]=[];
    const title=child(section,'title');if(title){walk(title,material);if(!material.length)material.push({kind:'heading',text:sectionTitle})}
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
    notes,fullText:blocks.map(b=>b.kind==='image'?'':b.kind==='table'?b.rows.flat().join(' '):b.text).join('\n')};
}
