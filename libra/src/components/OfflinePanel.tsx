import {useEffect,useState} from 'react';
import {prepareOffline} from '../offline';

export function OfflinePanel(){
 const [busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState('');
 async function check(){
  setBusy(true);setError('');
  try{await prepareOffline();setReady(true);void navigator.storage?.persist?.().catch(()=>false)}
  catch(e){setReady(false);setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 useEffect(()=>{void check()},[]);
 return <section className="backup-panel" aria-label="Работа без интернета">
  <h2>Без интернета</h2>
  <p role="status">{busy?'Сохраняем приложение на устройстве…':ready?'Готово к работе без интернета и VPN':error}</p>
  <p className="setting-hint">Загруженные книги, чтение и настройки доступны без сети. Интернет нужен для синхронизации и обновлений.</p>
  <button type="button" disabled={busy} onClick={()=>void check()}>{busy?'Подготовка…':ready?'Проверить ещё раз':'Подготовить заново'}</button>
 </section>;
}
