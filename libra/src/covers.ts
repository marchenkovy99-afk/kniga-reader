/** Convert ephemeral epub.js blob: cover links into portable, safe image data. */
const MAX_COVER_BYTES=1_500_000;
export async function coverDataUrl(url:string|undefined):Promise<string|undefined>{
 if(!url||!(url.startsWith('blob:')||url.startsWith('data:image/')))return;
 try{
  const response=await fetch(url);
  if(!response.ok)return;
  const file=await response.blob();
  if(!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)||!file.size||file.size>MAX_COVER_BYTES)return;
  return await new Promise<string|undefined>(resolve=>{
   const reader=new FileReader();
   reader.onerror=()=>resolve(undefined);
   reader.onload=()=>{
    const value=String(reader.result||'');
    resolve(value.startsWith('data:image/')?value:undefined);
   };
   reader.readAsDataURL(file);
  });
 }catch{return}
}
export async function extractEpubCover(file:Blob):Promise<string|undefined>{
 if(file.size>50_000_000)return;
 const {default:ePub}=await import('epubjs');
 const book=ePub(await file.arrayBuffer());
 try{await book.loaded.metadata;return await coverDataUrl(await book.coverUrl())}
 finally{book.destroy()}
}
