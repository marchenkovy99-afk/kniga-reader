import {useRef,useState} from 'react';
import {createBackup,parseBackup} from '../backup';
import {listBooks,mergeBackupBooks} from '../storage';
import type {ReaderSettings} from '../domain';

type Props={settings:ReaderSettings;onSettings:(settings:ReaderSettings)=>void;onImported:()=>Promise<void>};
export function BackupPanel({settings,onSettings,onImported}:Props){
 const choose=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(false);
 const [restoreAppearance,setRestoreAppearance]=useState(false);
 const [status,setStatus]=useState('');
 const [error,setError]=useState('');
 async function exportAll(){
  setBusy(true);setStatus('');setError('');
  try{
   // Fresh IndexedDB read: React's in-memory library may lag recent page flips.
   const current=await listBooks();
   const backup=await createBackup(current,settings);
   const url=URL.createObjectURL(backup);
   const a=document.createElement('a');
   a.href=url;
   a.download='libra-backup-'+new Date().toISOString().slice(0,10)+'.json';
   document.body.appendChild(a);
   a.click();a.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),30_000);
   setStatus('Файл содержит '+current.length+' книг, исходные файлы, закладки, прогресс и настройки.');
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 async function importAll(file:File){
  setBusy(true);setStatus('');setError('');
  try{
   // Complete preflight + SHA-256 integrity check precedes *any* mutation.
   const snapshot=await parseBackup(file);
   const result=await mergeBackupBooks(snapshot.books);
   if(restoreAppearance)onSettings(snapshot.settings);
   await onImported();
   setStatus('Добавлено книг: '+result.added+'. Уже есть в библиотеке: '+result.skipped+
    '. Существующие книги, позиции и закладки не изменены.');
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 return <section className="backup-panel" aria-label="Резервное копирование">
   <h3>Резервная копия</h3>
   <p>Сохраните книги и прогресс чтения в одном файле. Это особенно важно перед сменой телефона или переустановкой приложения.</p>
   <button type="button" className="backup-action" disabled={busy} onClick={()=>void exportAll()}>
    Скачать копию библиотеки
   </button>
   <input ref={choose} hidden type="file" accept=".json,application/json"
    aria-label="Выбрать резервную копию LIBRA" onChange={e=>{
     const file=e.target.files?.[0];e.target.value='';
     if(file)void importAll(file);
    }}/>
   <button type="button" className="backup-action backup-secondary" disabled={busy}
    onClick={()=>choose.current?.click()}>Восстановить из файла</button>
   <label className="backup-option"><input type="checkbox" checked={restoreAppearance}
    onChange={e=>setRestoreAppearance(e.target.checked)}/>
    Восстановить также настройки оформления
   </label>
   <p className="backup-footnote">Восстановление только добавляет отсутствующие книги. Совпадающие ID пропускаются: существующие файлы и прогресс не перезаписываются. Перед восстановлением архив целиком проверяется по контрольным суммам SHA-256.</p>
   {busy&&<p role="status" className="backup-feedback">Проверяем файлы…</p>}
   {status&&<p role="status" className="backup-feedback">{status}</p>}
   {error&&<p role="alert" className="backup-error">{error}</p>}
 </section>;
}
