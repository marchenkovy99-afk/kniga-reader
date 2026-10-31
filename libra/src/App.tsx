import { useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, type ReaderSettings, type ReaderPosition, type StoredBook, type Format } from './domain';
import { listBooks, deleteBook, loadSettings, saveBook, saveSettings, setBookFavorite, updateBookCover } from './storage';
import { parseFB2 } from './fb2';
import { decodeFB2Blob } from './fb2Encoding';
import { seedParsedFB2, forgetParsedFB2 } from './reader/parsedFB2Cache';
import { setTheme,PALETTES } from './theme';
import { normalizeSettings } from './readerSettings';
import {useCloudSync} from './useCloudSync';
import { Library } from './components/Library';
import { FB2Reader } from './reader/FB2Reader';
import { EpubReader } from './reader/EpubReader';
import {extractEpubCover,coverDataUrl} from './covers';

const supported=(name:string):Format|null=>{
 const ext=name.split('.').pop()?.toLowerCase();
 return ext==='fb2'||ext==='epub'?ext:null;
};
export default function App(){
 const [books,setBooks]=useState<StoredBook[]>([]);
 const [settings,setSettings]=useState<ReaderSettings>(DEFAULT_SETTINGS);
 const [opened,setOpened]=useState<StoredBook|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const [hydrated,setHydrated]=useState(false);
 const coverAttempts=useRef(new Set<string>());
 const cloud=useCloudSync(async()=>{const [stored,preferences]=await Promise.all([listBooks(),loadSettings()]);setBooks(stored);setSettings(normalizeSettings(preferences??DEFAULT_SETTINGS))},()=>setOpened(null));
 useEffect(()=>{
  let live=true;
  Promise.all([listBooks(),loadSettings()]).then(([stored,preferences])=>{
   if(!live)return;setBooks(stored);if(preferences)setSettings(normalizeSettings(preferences));setHydrated(true);
  }).catch(e=>{if(live)setError('Не удалось открыть локальную библиотеку: '+String(e))});
  return ()=>{live=false};
 },[]);
 useEffect(()=>{
  setTheme(settings.theme);
  document.documentElement.dataset.libraryView=opened?'false':'true';
  const background=opened?PALETTES[settings.theme].background:'#151515';
  document.documentElement.style.backgroundColor=background;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',background);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content',opened?PALETTES[settings.theme].status:'black');
 },[settings,opened]);
 async function refresh(){try{setBooks(await listBooks())}catch(e){setError(String(e))}}
 // Previous EPUB imports discarded blob: cover links. Recover those covers
 // from the original files without changing the reading position or bookmarks.
 useEffect(()=>{
  if(!hydrated)return;
  const book=books.find(b=>b.format==='epub'&&!b.cover&&!coverAttempts.current.has(b.id));
  if(!book)return;
  coverAttempts.current.add(book.id);
  let cancelled=false,finished=false;
  void extractEpubCover(book.file).then(async cover=>{
   if(cancelled||!cover)return;
   await updateBookCover(book.id,cover);
   if(!cancelled)await refresh();
  }).catch(e=>console.warn('Не удалось восстановить обложку EPUB',e))
   .finally(()=>{finished=true});
  return ()=>{cancelled=true;if(!finished)coverAttempts.current.delete(book.id)};
 },[hydrated,books]);

 async function importFiles(list:FileList){
   setLoading(true);setError('');
   for(const file of Array.from(list)){
     try{
       const format=supported(file.name);
       if(!format)throw new Error('Поддерживаются только FB2 и EPUB');
       const blob=new Blob([await file.arrayBuffer()],{type:file.type||'application/octet-stream'});
       let title=file.name.replace(/\.[^.]+$/,'').replace(/_/g,' '),author='Автор не указан',cover: string|undefined;
       const id=typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
       if(format==='fb2'){
         const parsed=parseFB2(await decodeFB2Blob(file));title=parsed.title;author=parsed.author;cover=parsed.cover;
         seedParsedFB2(id,parsed);
       }
       if(format==='epub'){
         try{
           const {default:ePub}=await import('epubjs');
           const epub=ePub(await file.arrayBuffer());
           const meta=await epub.loaded.metadata;
           title=meta.title||title;author=meta.creator||author;
           try{cover=await coverDataUrl(await epub.coverUrl())}catch{}
           epub.destroy();
         }catch{/* The file is validated again at opening; metadata is optional. */}
       }
       const book:StoredBook={id,filename:file.name,title,author,format,file:blob,cover,
         importedAt:Date.now(),bookmarks:[]};
       await saveBook(book);
     }catch(e){setError('Не удалось импортировать '+file.name+': '+(e instanceof Error?e.message:String(e)))}
   }
   await refresh();setLoading(false);
 }
 async function remove(book:StoredBook){
  if(!window.confirm('Удалить «'+book.title+'» из библиотеки?'))return;
  try{await deleteBook(book.id);forgetParsedFB2(book.id);await refresh()}catch(e){setError(String(e))}
 }
 async function toggleFavorite(book:StoredBook){try{await setBookFavorite(book.id,!book.isFavorite);await refresh()}catch(e){setError('Не удалось обновить избранное: '+String(e))}}
 function back(){setOpened(null);void refresh()}
 function update(s:ReaderSettings){
  const next=normalizeSettings(s);
  setSettings(next);
  // Persist only an explicit preference change. Cloud hydration must never
  // rewrite the incoming account's settings with the previous render's values.
  void saveSettings(next).catch(e=>setError('Не удалось сохранить настройки чтения: '+String(e)));
 }
 return <>
  {opened&&opened.format!=='pdf'?(opened.format==='fb2'?<FB2Reader book={opened} settings={settings} onSettings={update} onBack={back}/>:
   <EpubReader book={opened} settings={settings} onSettings={update} onBack={back}/>):
   <Library cloud={cloud} books={books.filter(book=>book.format!=='pdf')} settings={settings} onSettings={update} onOpen={(book:StoredBook,position?:ReaderPosition)=>{if(book.format!=='pdf')setOpened(position?{...book,position}:book)}} onImport={files=>void importFiles(files)}
     onDelete={book=>void remove(book)} onFavorite={book=>void toggleFavorite(book)} onBackupImported={refresh} loading={loading}/>}
  {error&&<div className="app-error" role="alert">{error}<button onClick={()=>setError('')}>Закрыть</button></div>}
 </>;
}
