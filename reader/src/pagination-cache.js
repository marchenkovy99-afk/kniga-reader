import {sha256} from 'js-sha256';

// Bump when pagination markup or the book-text layout CSS changes.
const VERSION=15;
const typography=['font','fontSize','lineHeight','margin','paragraphGap','indent','letterSpacing','align','hyphens'];
const sourceHashes=new WeakMap();
function signature({bookId,blocks,width,height,settings,environment='',engine='dom'}){
 let source=sourceHashes.get(blocks);
 if(!source){const hash=sha256.create();for(const block of blocks)hash.update(JSON.stringify([block.type,block.text,block.html,block.presentation]));source=hash.hex();sourceHashes.set(blocks,source);}
 return sha256(JSON.stringify([VERSION,engine,bookId,source,width,height,environment,typography.map(key=>settings[key])]));
}
const storageKey=id=>'pagination-cache:'+id;
function checkAbort(signal){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');}
function validPages(pages,blocks){
 const validAnchor=a=>a&&Number.isInteger(a.block)&&a.block>=0&&a.block<blocks.length&&Number.isInteger(a.offset)&&a.offset>=0&&a.offset<=blocks[a.block].text.length;
 if(!Array.isArray(pages)||!pages.length||pages.length>2001||!pages.every(p=>typeof p?.html==='string'&&p.html.trim()&&validAnchor(p.start)&&validAnchor(p.end)))return false;
 if(pages[0].start.block!==0||pages[0].start.offset!==0)return false;
 const end=pages.at(-1).end;
 if(end.block!==blocks.length-1||end.offset!==blocks.at(-1).text.length)return false;
 return pages.every((page,index)=>{
  if(page.end.block<page.start.block||(page.end.block===page.start.block&&page.end.offset<page.start.offset))return false;
  if(!index)return true;
  const previous=pages[index-1].end,next=page.start;
  return previous.block===next.block?previous.offset===next.offset:
   previous.block+1===next.block&&previous.offset===blocks[previous.block].text.length&&next.offset===0;
 });
}

/** Page HTML and source anchors stay on this device; they are never synced. */
export function createPaginationCache({storage,paginate,onStorageError=()=>{},validatePages=()=>{}}){
 const memory=new Map();let writes=Promise.resolve(),reported=false;
 const report=error=>{if(!reported){reported=true;onStorageError(error);}};
 const remember=(key,bookId,pages)=>{memory.delete(key);memory.set(key,{bookId,pages});if(memory.size>3)memory.delete(memory.keys().next().value);};
 const read=async bookId=>{try{return await storage.getPreference(storageKey(bookId));}catch(error){report(error);return null;}};
 async function load(input){
  const {bookId,blocks,signal,onMiss}=input,key=signature(input);checkAbort(signal);
  const hit=memory.get(key);
  if(hit){remember(key,bookId,hit.pages);return hit.pages;}
  const saved=await read(bookId);checkAbort(signal);
  const entry=saved?.version===VERSION&&Array.isArray(saved.entries)?saved.entries.find(e=>e?.signature===key):null;
  let intact=false;
  if(entry&&validPages(entry.pages,blocks)){try{validatePages(blocks,entry.pages);intact=true;}catch{/* Regenerate damaged cached markup from the source. */}}
  if(intact){remember(key,bookId,entry.pages);return entry.pages;}
  onMiss?.();
  const pages=await paginate(blocks,input);checkAbort(signal);
  // Serialize read/merge/write so rapid typography changes keep both layouts.
  const write=writes.then(async()=>{
   checkAbort(signal);const previous=await read(bookId);checkAbort(signal);
   const entries=previous?.version===VERSION&&Array.isArray(previous.entries)?previous.entries.filter(e=>e&&typeof e.signature==='string'&&e.signature!==key):[];
   await storage.setPreference(storageKey(bookId),{version:VERSION,entries:[...entries,{signature:key,pages}].slice(-3)});
  });
  writes=write.catch(()=>{});
  try{await write;}catch(error){if(error.name==='AbortError')throw error;report(error);}
  checkAbort(signal);remember(key,bookId,pages);return pages;
 }
 async function remove(bookId){
  for(const [key,value] of memory)if(value.bookId===bookId)memory.delete(key);
  await writes;
  try{await storage.deletePreference(storageKey(bookId));}catch(error){report(error);}
 }
 return {load,remove};
}
