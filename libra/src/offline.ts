export type OfflineStatus={ready:boolean;files:number};

/** Installation completes only when every required local asset has been saved. */
export async function prepareOffline():Promise<OfflineStatus>{
 if(!('serviceWorker' in navigator))throw new Error('Браузер не поддерживает офлайн-режим');
 const registration=await navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{
  scope:import.meta.env.BASE_URL,updateViaCache:'none'
 });
 const worker=registration.installing||registration.waiting||registration.active;
 if(!worker)throw new Error('Не удалось установить офлайн-версию');
 if(worker.state!=='activated')await new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>{cleanup();reject(new Error('Загрузка не завершена. Проверьте соединение и повторите'))},30000);
  const cleanup=()=>{clearTimeout(timer);worker.removeEventListener('statechange',check)};
  const check=()=>{
   if(worker.state==='activated'){cleanup();resolve()}
   else if(worker.state==='redundant'){cleanup();reject(new Error('Не все файлы удалось сохранить. Повторите с работающим соединением'))}
  };
  worker.addEventListener('statechange',check);check();
 });
 return new Promise((resolve,reject)=>{
  const channel=new MessageChannel();
  const timer=setTimeout(()=>{channel.port1.close();reject(new Error('Офлайн-версия ещё не готова. Нажмите «Подготовить заново»'))},5000);
  channel.port1.onmessage=event=>{
   clearTimeout(timer);channel.port1.close();
   if(event.data?.ready)resolve({ready:true,files:event.data.files});
   else reject(new Error('Не все файлы сохранены. Подготовьте приложение заново с интернетом'));
  };
  worker.postMessage({type:'LIBRA_OFFLINE_STATUS'},[channel.port2]);
 });
}
