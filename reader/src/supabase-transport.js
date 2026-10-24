const result=data=>Response.json(data);
const fail=(message,status)=>{const e=new Error(message);e.status=status;return e;};
const check=({data,error})=>{if(error)throw fail(error.message,error.status||error.statusCode);return data;};
async function allRows(client,table){
 const rows=[];for(let at=0;at<10000;at+=1000){const page=check(await client.from(table).select('*').order(table==='kniga_books'?'id':'device_id').order(table==='kniga_books'?'id':'key').range(at,at+999));rows.push(...page);if(page.length<1000)return rows;}throw Error('Слишком много записей в облаке.');
}
export class SupabaseTransport {
 constructor(client){this.client=client;}
 async api(url,options={}){
  const c=this.client;const auth=await c.auth.getUser();const user=auth.data?.user;
  if(auth.error||!user)throw fail('Войдите в облако по почте и паролю.',401);
  const method=options.method||'GET';
  if(url==='/api/cloud'&&method==='GET'){
   const [books,states]=await Promise.all([allRows(c,'kniga_books'),allRows(c,'kniga_states')]);
   return result({userId:user.id,displayName:user.email,books:books.map(b=>({id:b.id,fileName:b.file_name,size:b.size_bytes})),states:states.map(s=>({deviceId:s.device_id,key:s.key,payload:s.payload,clientUpdatedAt:s.client_updated_at}))});
  }
  if(url==='/api/cloud/state'&&method==='PUT'){
   const record=JSON.parse(options.body);
   if(!/^[a-f0-9-]{36}$/i.test(record.deviceId)||! /^(settings|(position|appearance):(sample|[a-f0-9]{64}))$/.test(record.key)||!Number.isFinite(record.clientUpdatedAt)||!record.payload||typeof record.payload!=='object')throw Error('Некорректные данные синхронизации.');
   check(await c.from('kniga_states').upsert({user_id:user.id,device_id:record.deviceId,key:record.key,payload:record.payload,client_updated_at:record.clientUpdatedAt},{onConflict:'user_id,device_id,key'}));return result({saved:true});
  }
  const id=url.slice('/api/cloud/book/'.length);
  if(!url.startsWith('/api/cloud/book/')||! /^[a-f0-9]{64}$/.test(id))throw Error('Некорректный идентификатор книги.');
  const path=user.id+'/'+id;const bucket=c.storage.from('kniga-books');
  if(method==='GET')return new Response(check(await bucket.download(path)));
  if(method==='PUT'){
   const size=options.body?.byteLength||options.body?.size||0;
   if(size<1||size>20*1024*1024)throw Error('Размер книги должен быть от 1 байта до 20 МБ.');
   const name=decodeURIComponent(options.headers?.['x-book-name']||'book.fb2');
   if(name.length>500||! /\.(fb2|zip|fbz|epub|txt)$/i.test(name))throw Error('Неподдерживаемый файл.');
   const upload=await bucket.upload(path,options.body,{contentType:'application/octet-stream',upsert:false});
   if(upload.error&&String(upload.error.statusCode)!=='409')throw Error(upload.error.message);
   check(await c.from('kniga_books').upsert({user_id:user.id,id,file_name:name,size_bytes:size},{onConflict:'user_id,id'}));return result({saved:true});
  }
  throw Error('Неподдерживаемый запрос облака.');
 }
}
