// Covers are derived from metadata, never persisted or downloaded.
const palettes=[['#243f53','#f4ead7','#98b7be'],['#304c43','#f3ead6','#a8b69a'],['#673d46','#f5e9d8','#c89c91'],['#494461','#f1e8dd','#b8adc7'],['#84523b','#fff0dc','#d3b68b'],['#364c65','#f3ece2','#a4b8cf']];
const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalized=text=>String(text??'').replace(/\s+/gu,' ').trim();
export function coverDesign(book){
 const key=normalized(book.author)+'|'+normalized(book.title);let hash=2166136261;
 for(const c of key)hash=Math.imul(hash^c.codePointAt(0),16777619)>>>0;
 const title=normalized(book.title).toLowerCase();
 const sea=/море|океан/.test(title),stairs=/лестниц/.test(title);
 const index=sea?0:stairs?1:hash%palettes.length;
 return {colors:palettes[index],motif:sea?'waves':stairs?'stairs':['arcs','orbits','steps'][hash%3]};
}
export function fitCoverText(text,{width=192,height=166,maxSize=34,measure=(s,size)=>[...s].length*size*.67}={}){
 const words=(normalized(text)||'Без названия').split(' ');
 // Shrink the whole composition, preserving words and all title characters.
 for(let size=maxSize;size>=.5;size-=.5){
  const lines=[];let line='';let tooWide=false;
  for(const word of words){
   if(measure(word,size)>width){tooWide=true;break;}
   const next=line?line+' '+word:word;
   if(line&&measure(next,size)>width){lines.push(line);line=word;}else line=next;
  }
  if(tooWide)continue;
  if(line)lines.push(line);
  if(lines.length*size*1.16<=height)return {lines,size};
 }
 return {lines:[normalized(text)],size:.5};
}
let context;
function measure(text,size){
 if(typeof document==='undefined')return [...text].length*size*.67;
 context??=document.createElement('canvas').getContext('2d');
 if(!context)return [...text].length*size*.67;
 context.font=`${size}px Georgia`;return context.measureText(text).width;
}
function art(motif){
 if(motif==='waves')return '<path d="M-10 287 Q20 273 50 287 T110 287 T170 287 T250 287 M-10 304 Q20 290 50 304 T110 304 T170 304 T250 304 M-10 321 Q20 307 50 321 T110 321 T170 321 T250 321"/>';
 if(motif==='stairs'||motif==='steps')return '<path d="M30 334V324H60V314H90V304H120V294H150V284H180V274H210 M60 334V324H90V314H120V304H150V294H180V284H210"/>';
 if(motif==='orbits')return '<ellipse cx="166" cy="303" rx="46" ry="23" transform="rotate(-25 166 303)"/><ellipse cx="166" cy="303" rx="46" ry="23" transform="rotate(25 166 303)"/>';
 return '<path d="M65 334V319a55 48 0 0 1 110 0v15 M80 334V319a40 34 0 0 1 80 0v15 M95 334V319a25 20 0 0 1 50 0v15"/>';
}
function safeImage(value){return typeof value==='string'&&/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z\d+/=\s]+$/i.test(value);}
export function renderCover(book,small=false){
 const image=safeImage(book.progress?.coverImage)?book.progress.coverImage:safeImage(book.cover)?book.cover:null;
 if(image)return `<div class="cover cover-original ${small?'small':''}"><img src="${escape(image)}" alt="Обложка книги ${escape(book.title)}" loading="lazy" decoding="async"></div>`;
 const {colors:[bg,ink,accent],motif}=coverDesign(book);
 const title=fitCoverText(book.title,{measure});
 const author=fitCoverText(book.author||'Автор не указан',{width:192,height:42,maxSize:13,measure});
 const text=(fit,y)=>fit.lines.map((line,i)=>`<text x="24" y="${y+i*fit.size*1.16}" font-size="${fit.size}">${escape(line)}</text>`).join('');
 return `<div class="cover cover-generated ${small?'small':''}"><svg viewBox="0 0 240 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escape(book.author)}. ${escape(book.title)}"><rect width="240" height="360" fill="${bg}"/><g fill="none" stroke="${accent}" stroke-width="1.4" opacity=".7">${art(motif)}</g><g fill="${ink}" font-family="Georgia, 'Times New Roman', serif">${text(author,30+author.size)}${text(title,91+title.size*.82)}</g></svg></div>`;
}
// Decode raster uploads and re-encode them to discard metadata and active content.
export async function prepareCoverImage(file){
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Выберите изображение JPEG, PNG или WebP.');
 if(file.size>8*1024*1024)throw Error('Изображение должно быть меньше 8 МБ.');
 const url=URL.createObjectURL(file),image=new Image();
 try{
  image.src=url;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw Error('Слишком большое разрешение изображения.');
  const scale=Math.min(1,480/image.naturalWidth,720/image.naturalHeight);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Не удалось обработать изображение.');
  ctx.fillStyle='#f4ead7';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const result=canvas.toDataURL('image/jpeg',.78);
  if(result.length>180000)throw Error('Изображение слишком сложное. Выберите меньшую картинку.');
  return result;
 }catch(error){throw Error(error.message||'Не удалось прочитать изображение.');}finally{URL.revokeObjectURL(url);}
}
