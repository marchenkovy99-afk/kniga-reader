import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function context(request:Request,write=false){
 const user=await getChatGPTUser();if(!user)return {error:json({error:'Войдите через ChatGPT, чтобы включить облако.'},401)};
 if(write){const origin=request.headers.get('origin');if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')return {error:json({error:'Запрос с другого сайта отклонён.'},403)};}
 const bucket=env.BUCKET;if(!bucket)return {error:json({error:'Облачное хранилище ещё не подключено.'},503)};
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user.userId));
 const owner=Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('');
 return {user,bucket,prefix:`reader/v1/${owner}/`};
}
export async function limitedBody(request:Request,max:number){
 if(Number(request.headers.get('content-length'))>max)throw new Error('Файл превышает допустимый размер.');
 const reader=request.body?.getReader();if(!reader)throw new Error('Запрос пуст.');
 const parts:Uint8Array[]=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Error('Файл превышает допустимый размер.');}parts.push(value);}
 const result=new Uint8Array(size);let at=0;for(const part of parts){result.set(part,at);at+=part.length;}return result;
}
export const validBookId=(id:string)=>/^[a-f0-9]{64}$/.test(id);
export async function listAll(bucket: R2Bucket,prefix:string){
 const objects:R2Object[]=[];let cursor:string|undefined;
 do{const result=await bucket.list({prefix,cursor,limit:1000});objects.push(...result.objects);cursor=result.truncated?result.cursor:undefined;if(objects.length>5000)throw new Error('Слишком много записей для черновой версии.');}while(cursor);
 return objects;
}
