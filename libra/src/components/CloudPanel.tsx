import {useState} from 'react';
import type {CloudController} from '../useCloudSync';
import './cloud.css';
export function CloudPanel({cloud}:{cloud:CloudController}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false);
 return <section className="cloud-panel" aria-labelledby="cloud-title">
  <h3 id="cloud-title">Синхронизация Supabase</h3><p>Книги, место чтения, закладки и оформление синхронизируются между устройствами после подключения аккаунта. Читать можно без сети, изменения отправляются при возвращении в приложение.</p>
  {cloud.session?<>
   <p className="cloud-account">{cloud.session.user.email}</p>
   <p>{cloud.enabled?<>В очереди: {cloud.pending}. Удаление книги передаётся на другие устройства; скачанные там файлы сохраняются в локальном архиве.</>:'Подключите эту библиотеку к аккаунту. Книги другого аккаунта не переносятся.'}</p>
   <div className="cloud-actions"><button disabled={cloud.busy} onClick={()=>void (cloud.enabled?cloud.sync():cloud.connect())}>{cloud.busy?'Синхронизация…':cloud.enabled?'Синхронизировать':'Подключить и объединить библиотеку'}</button><button className="cloud-secondary" disabled={cloud.busy} onClick={()=>void cloud.signOut()}>Выйти</button></div>
  </>:<>
   <p>Войдите в один аккаунт на каждом устройстве. Это отдельный вход в облачную библиотеку.</p>
   <form onSubmit={e=>{e.preventDefault();void cloud.auth(email.trim(),password,signup).then(()=>setPassword(''))}}>
    <label>Электронная почта<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Пароль<input type="password" autoComplete={signup?'new-password':'current-password'} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <div className="cloud-actions"><button type="submit" disabled={!cloud.ready||cloud.busy}>{cloud.busy?'Подождите…':signup?'Создать аккаунт':'Войти'}</button><button className="cloud-secondary" type="button" onClick={()=>setSignup(!signup)}>{signup?'У меня есть аккаунт':'Создать аккаунт'}</button></div>
   </form>
  </>}
  {cloud.hidden&&<p>На устройстве сохранены книги другой учётной записи. Для доступа войдите в неё.</p>}
  {cloud.message&&<p role="status">{cloud.message}</p>}
  {cloud.error&&<p role="alert" className="cloud-error">{cloud.error} Локальные изменения сохранены. Проверьте сеть или войдите снова, затем повторите синхронизацию.</p>}
  {cloud.conflicts.map(conflict=><div className="cloud-conflict" key={conflict.key}><strong>{conflict.title}</strong><p>Эта запись изменилась и здесь, и в облаке. Какую версию сохранить?</p><div className="cloud-actions"><button disabled={cloud.busy} onClick={()=>void cloud.resolve(conflict,'local')}>Версию устройства</button><button disabled={cloud.busy} className="cloud-secondary" onClick={()=>void cloud.resolve(conflict,'remote')}>Версию облака</button></div></div>)}
 </section>;
}
