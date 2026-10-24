import {context,json,listAll} from '../../../server/cloud';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const c=await context(request);if(c.error)return c.error;
 try{
  const books=await listAll(c.bucket!,c.prefix+'books/');const objects=await listAll(c.bucket!,c.prefix+'states/');
  const states=[];const bookInfo=[];for(const b of books){const head=await c.bucket!.head(b.key);bookInfo.push({id:b.key.split('/').at(-1),fileName:decodeURIComponent(head?.customMetadata?.fileName||'book.fb2'),size:b.size});}
  for(const entry of objects){const object=await c.bucket!.get(entry.key);if(object){const data=await object.json();states.push({...data as object,etag:object.etag});}}
  return json({userId:c.user!.userId,displayName:c.user!.displayName,books:bookInfo,states});
 }catch{return json({error:'Не удалось прочитать облачную библиотеку. Попробуйте позже.'},503);}
}
