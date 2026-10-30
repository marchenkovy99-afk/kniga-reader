import {useCallback,useEffect,useRef,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {cloudClient,cloudTransport} from './cloudClient';
import {runCloudSync,resolveCloudConflict,type CloudConflict} from './cloudSync';
import {attachLocalLibrary,cloudDeviceState,getCloudEntries,onStorageChange,setCloudAccount} from './storage';
export function useCloudSync(onChange:()=>Promise<void>,onAccountChange:()=>void){
 const callbacks=useRef({onChange,onAccountChange});callbacks.current={onChange,onAccountChange};
 const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false),[enabled,setEnabled]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState(0),[hidden,setHidden]=useState(false);
 const [conflicts,setConflicts]=useState<CloudConflict[]>([]);
 const current=useRef<Session|null>(null),running=useRef(false),again=useRef(false),mounted=useRef(true),epoch=useRef(0);
 const updateState=useCallback(async()=>{const device=await cloudDeviceState();if(!mounted.current)return;setEnabled(device.enabled);setHidden(device.hidden);setPending(device.owner?(await getCloudEntries(device.owner)).filter(e=>e.pending).length:0)},[]);
 const sync=useCallback(async()=>{
  const active=current.current;if(!active)return;
  const device=await cloudDeviceState();if(!device.enabled||device.owner!==active.user.id)return;
  if(running.current){again.current=true;return}
  if(!navigator.onLine){setMessage('Нет сети. Изменения сохранены на устройстве');await updateState();return}
  const token=epoch.current;running.current=true;setBusy(true);setError('');
  try{
   const result=await runCloudSync(active.user.id,cloudTransport(active.user.id));
   if(token!==epoch.current)return;
   setConflicts(result.conflicts);setMessage(result.conflicts.length?'Есть изменения на двух устройствах. Выберите нужную версию':'Синхронизировано · '+new Date().toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}));
   if(result.applied)await callbacks.current.onChange();
  }catch(e){if(token===epoch.current)setError('Синхронизация приостановлена: '+(e instanceof Error?e.message:String(e)))}
  finally{running.current=false;if(mounted.current){setBusy(false);await updateState()}if(again.current){again.current=false;setTimeout(()=>{if(mounted.current)void sync()},1200)}}
 },[updateState]);
 useEffect(()=>{
  mounted.current=true;let timer:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{void updateState();clearTimeout(timer);timer=setTimeout(()=>void sync(),1500)};
  const unsubscribe=onStorageChange(schedule);
  const subscription=cloudClient.auth.onAuthStateChange((_event,next)=>{
   current.current=next;setSession(next);setReady(true);
   // Auth callbacks stay synchronous: Supabase may hold its session lock here.
   if(next)setTimeout(()=>{void (async()=>{const previous=await cloudDeviceState();if(previous.owner!==next.user.id){epoch.current++;callbacks.current.onAccountChange()}await setCloudAccount(next.user.id);await updateState();await callbacks.current.onChange();void sync()})().catch(e=>setError(String(e)))},0);
   else void updateState(); // An expired refresh token must not hide offline books.
  });
  void updateState();const interval=setInterval(()=>{if(document.visibilityState==='visible')void sync()},30000);
  const signedOut=(event:StorageEvent)=>{if(event.key==='libra-cloud-signout'){epoch.current++;current.current=null;setSession(null);setConflicts([]);void setCloudAccount(null).then(()=>{callbacks.current.onAccountChange();return callbacks.current.onChange()}).then(updateState).catch(e=>setError(String(e)))}};
  window.addEventListener('storage',signedOut);window.addEventListener('online',schedule);window.addEventListener('offline',schedule);document.addEventListener('visibilitychange',schedule);
  return ()=>{mounted.current=false;clearTimeout(timer);clearInterval(interval);unsubscribe();subscription.data.subscription.unsubscribe();window.removeEventListener('storage',signedOut);window.removeEventListener('online',schedule);window.removeEventListener('offline',schedule);document.removeEventListener('visibilitychange',schedule)};
 },[sync,updateState]);
 async function auth(email:string,password:string,signup:boolean){
  setError('');setMessage('');setBusy(true);
  try{const {data,error:failure}=signup?await cloudClient.auth.signUp({email,password}):await cloudClient.auth.signInWithPassword({email,password});if(failure)throw failure;if(signup&&!data.session)setMessage('Подтвердите адрес по письму, затем вернитесь сюда и войдите с паролем')}
  catch(e){setError((e instanceof Error?e.message:String(e)))}finally{setBusy(false)}
 }
 async function connect(){if(!session)return;setError('');try{await attachLocalLibrary(session.user.id);await callbacks.current.onChange();await updateState();await sync()}catch(e){setError(String(e))}}
 async function signOut(){setError('');try{const {error:failure}=await cloudClient.auth.signOut({scope:'local'});if(failure)throw failure;localStorage.setItem('libra-cloud-signout',String(Date.now()));epoch.current++;current.current=null;setSession(null);setConflicts([]);setMessage('Вы вышли. Файлы сохранены на устройстве');await setCloudAccount(null);callbacks.current.onAccountChange();await callbacks.current.onChange();await updateState()}catch(e){setError(String(e))}}
 async function resolve(conflict:CloudConflict,choice:'local'|'remote'){
  if(!session||running.current)return;running.current=true;setBusy(true);setError('');try{await resolveCloudConflict(session.user.id,conflict,choice,cloudTransport(session.user.id));setConflicts(previous=>previous.filter(c=>c.key!==conflict.key));await callbacks.current.onChange();running.current=false;await sync()}catch(e){setError(String(e))}finally{running.current=false;setBusy(false);await updateState()}
 }
 return {session,ready,enabled,busy,error,message,pending,hidden,conflicts,auth,connect,signOut,sync,resolve};
}
export type CloudController=ReturnType<typeof useCloudSync>;
