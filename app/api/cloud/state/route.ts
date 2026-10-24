import {context,json,limitedBody} from '../../../../server/cloud';
export const dynamic='force-dynamic';
export async function PUT(request:Request){
 const c=await context(request,true);if(c.error)return c.error;
 try{
  const bytes=await limitedBody(request,256*1024);const data=JSON.parse(new TextDecoder().decode(bytes));
  if(!/^[a-f0-9-]{36}$/i.test(data.deviceId)||! /^(settings|(position|appearance):(sample|[a-f0-9]{64}))$/.test(data.key)||!Number.isFinite(data.clientUpdatedAt)||typeof data.payload!=='object'||!data.payload)return json({error:'Некорректные данные синхронизации.'},400);
  const record={deviceId:data.deviceId,key:data.key,payload:data.payload,clientUpdatedAt:data.clientUpdatedAt,serverUpdatedAt:Date.now()};
  const key=c.prefix+'states/'+data.deviceId+'/'+data.key.replace(':','_');
  const etag=request.headers.get('if-match');
  const result=await c.bucket!.put(key,JSON.stringify(record),{httpMetadata:{contentType:'application/json'},onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'}});
  if(!result)return json({error:'Запись обновлена в другом окне. Повторите синхронизацию.'},409);
  return json({saved:true,etag:result.etag});
 }catch(e){return json({error:e instanceof Error?e.message:'Не удалось сохранить состояние.'},400);}
}
