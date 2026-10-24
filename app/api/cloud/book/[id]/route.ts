import {context,json,limitedBody,validBookId} from '../../../../../server/cloud';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!validBookId(id))return json({error:'Некорректный идентификатор книги.'},400);
 const c=await context(request);if(c.error)return c.error;
 const object=await c.bucket!.get(c.prefix+'books/'+id);if(!object)return json({error:'Книга в облаке не найдена.'},404);
 return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment'}});
}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!validBookId(id))return json({error:'Некорректный идентификатор книги.'},400);
 const c=await context(request,true);if(c.error)return c.error;
 try{
  const key=c.prefix+'books/'+id;const existing=await c.bucket!.head(key);if(existing)return json({saved:true,exists:true});
  const bytes=await limitedBody(request,20*1024*1024);if(!bytes.length)return json({error:'Файл пуст.'},400);
  const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==id)return json({error:'Контрольная сумма книги не совпала.'},400);
  const name=decodeURIComponent(request.headers.get('x-book-name')||'book.fb2');if(name.length>500||! /\.(fb2|zip|fbz|epub|txt)$/i.test(name))return json({error:'Неподдерживаемый файл.'},400);
  await c.bucket!.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'},customMetadata:{fileName:encodeURIComponent(name)}});
  return json({saved:true});
 }catch(e){return json({error:e instanceof Error?e.message:'Книга не сохранена в облако.'},400);}
}
