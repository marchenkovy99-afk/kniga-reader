import {useRef,useState} from 'react';
import type {ReaderPosition,ReaderSettings,StoredBook} from '../domain';
import {bookmarkLocationLabel} from '../bookmarks';
import {BookCover} from './BookCover';
import {Icon} from './Icons';
import {BackupPanel} from './BackupPanel';
import {CloudPanel} from './CloudPanel';
import type {CloudController} from '../useCloudSync';
import {sortLibraryBooks,type LibraryOrder} from '../librarySort';
type Filter='all'|'reading'|'finished'|'favorite';
type Tab='library'|'bookmarks'|'settings';
type Props={cloud:CloudController;books:StoredBook[];settings:ReaderSettings;onSettings:(s:ReaderSettings)=>void;
 onOpen:(b:StoredBook,p?:ReaderPosition)=>void;onImport:(files:FileList)=>void;onDelete:(b:StoredBook)=>void;
 onFavorite:(b:StoredBook)=>void;onBackupImported:()=>Promise<void>;loading:boolean};
const fraction=(b:StoredBook)=>Math.max(0,Math.min(1,b.position?.fraction||0));
const progress=(b:StoredBook)=>fraction(b)>=1?100:Math.min(99,Math.round(fraction(b)*100));
export function Library({cloud,books,settings,onSettings,onOpen,onImport,onDelete,onFavorite,onBackupImported,loading}:Props){
 const input=useRef<HTMLInputElement>(null);
 const [tab,setTab]=useState<Tab>('library');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState<Filter>('all');
 const [order,setOrder]=useState<LibraryOrder>('recent');
 const [menu,setMenu]=useState<string|null>(null);
 const recent=sortLibraryBooks(books,'recent');
 const continueBook=recent.find(b=>b.position&&fraction(b)<1)||recent[0];
 const places=recent.flatMap(book=>book.bookmarks.map((position,index)=>({book,position,index})));
 const shown=sortLibraryBooks(recent.filter(b=>{
  if(!(b.title+' '+b.author).toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))return false;
  if(filter==='favorite')return b.isFavorite===true;
  if(filter==='reading')return fraction(b)>0&&fraction(b)<1;
  if(filter==='finished')return fraction(b)>=1;
  return true;
 }),order);
 const open=(b:StoredBook,p?:ReaderPosition)=>{setMenu(null);onOpen(b,p)};
 const actions=(b:StoredBook,key:string)=>menu===key&&<div className="book-actions" role="group" aria-label={'Действия с книгой '+b.title}>
  <button type="button" onClick={()=>{onFavorite(b);setMenu(null)}}>{b.isFavorite?'Убрать из избранного':'В избранное'}</button>
  <button type="button" onClick={()=>{setMenu(null);onDelete(b)}}>Удалить книгу</button>
 </div>;
 return <div className="library-shell">
  <input ref={input} type="file" accept=".fb2,.epub" multiple hidden onChange={e=>{if(e.target.files)onImport(e.target.files);e.target.value=''}}/>
  {tab==='library'&&<>
   <header className="library-header"><div className="library-page-title"><h1>Библиотека</h1></div></header>
   <main className="library-main">
    <div className="library-state-tabs" role="group" aria-label="Статус чтения">
     {([{id:'all',label:'Все книги'},{id:'reading',label:'Читаю'},{id:'finished',label:'Прочитано'},{id:'favorite',label:'В избранном'}] as const).map(x=><button key={x.id} type="button" aria-pressed={filter===x.id} onClick={()=>{setFilter(x.id);setMenu(null)}}>{x.label}</button>)}
    </div>
    {cloud.hidden&&!cloud.session&&<p className="setting-hint">Книги аккаунта сохранены на устройстве. Войдите в него в настройках, чтобы открыть библиотеку.</p>}
    {cloud.enabled&&cloud.session&&<p className="library-sync-status" role="status">{cloud.busy?'Синхронизация Supabase…':cloud.pending?'Ожидает синхронизации: '+cloud.pending:'Синхронизация Supabase подключена'}</p>}
    {continueBook&&<section className="continue-section" aria-label="Продолжить чтение"><div className="continue-wrapper">
     <button type="button" className="continue-card" onClick={()=>open(continueBook)}>
      <BookCover book={continueBook} large/>
      <span className="continue-info"><span className="continue-eyebrow">ПРОДОЛЖИТЬ ЧТЕНИЕ</span><strong>{continueBook.title}</strong>
       <span className="continue-author">{continueBook.author}</span>
       <span className="continue-progress-label">{progress(continueBook)}% прочитано</span>
       <span className="continue-line"><span style={{width:progress(continueBook)+'%'}}/></span>
       <span className="continue-cta">Продолжить <span aria-hidden="true">›</span></span>
      </span>
     </button>
     <button className="continue-more" type="button" title="Действия с книгой" aria-label="Действия с книгой" aria-expanded={menu===continueBook.id+':continue'} onClick={()=>setMenu(menu===continueBook.id+':continue'?null:continueBook.id+':continue')}><Icon name="more"/></button>
     {actions(continueBook,continueBook.id+':continue')}
    </div></section>}
    <section className="all-books">
     <div className="library-filters"><label className="search-wrap"><Icon name="search" size={20}/><input aria-label="Поиск книг" placeholder="Название или автор" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="sort-control"><Icon name="settings" size={22}/><select aria-label="Сортировка книг" value={order} onChange={e=>setOrder(e.target.value as LibraryOrder)}>
       <option value="recent">Недавно добавленные</option><option value="title">По названию</option>
       <option value="author">По автору</option><option value="progress">По прогрессу</option></select></div>
     </div>
     <div className="library-section-heading"><h2>Мои книги <small>{shown.length}</small></h2>
      <span className="sort-caption">{order==='recent'?'Недавно добавленные':order==='title'?'По названию':order==='author'?'По автору':'По прогрессу'} <span aria-hidden="true">⌄</span></span></div>
     {shown.length?<div className="book-grid">{shown.map(b=><div key={b.id} className="book-tile">
      <button className="book-tile-open" type="button" onClick={()=>open(b)}><BookCover book={b}/><strong>{b.title}</strong><small>{b.author}</small>
       <span className="book-tile-meta"><span>{b.format.toUpperCase()}</span><span>{b.position?progress(b)+'% прочитано':'Не начата'}</span></span>
       <span className="book-tile-progress"><span style={{width:progress(b)+'%'}}/></span></button>
      <button type="button" className="book-tile-menu" aria-expanded={menu===b.id} aria-label={'Действия с книгой «'+b.title+'»'} onClick={()=>setMenu(menu===b.id?null:b.id)}><Icon name="more"/></button>
      {actions(b,b.id)}
     </div>)}</div>:<div className="empty-library"><Icon name="book" size={34}/><strong>{books.length?'Книги не найдены':'В библиотеке пока нет книг'}</strong><p>{books.length?'Измените фильтр или поисковый запрос.':'Добавьте первую книгу в формате FB2 или EPUB.'}</p>
      <button type="button" onClick={()=>books.length?(setFilter('all'),setQuery('')):input.current?.click()}>{books.length?'Все книги':'Добавить книгу'}</button></div>}
    </section>
    {books.length>=3&&<section className="library-shelf"><h2>Недавно добавленные</h2><div className="library-shelf-scroll">
     {recent.slice(0,8).map(b=><button className="shelf-item" type="button" key={b.id} onClick={()=>open(b)}><BookCover book={b}/><span>{b.title}</span></button>)}
    </div></section>}
   </main>
  </>}
  {tab==='bookmarks'&&<main className="library-main library-secondary-page"><h1>Закладки</h1>
   {places.length?places.map(({book,position,index})=><button className="bookmark-item" key={book.id+':'+index} onClick={()=>open(book,position)}><BookCover book={book}/><span><strong>{book.title}</strong><small>{bookmarkLocationLabel(position,book.format)}</small></span></button>):
    <div className="empty-library"><Icon name="bookmark" size={40}/><strong>Пока нет закладок</strong><p>Отмечайте важные места во время чтения.</p></div>}
  </main>}
  {tab==='settings'&&<main className="library-main library-secondary-page"><h1>Настройки</h1>
   <div className="section-heading"><h2>Импорт книг</h2></div>
   <button className="backup-action" type="button" onClick={()=>input.current?.click()}>Добавить книгу (FB2, EPUB)</button>
   <div className="section-heading" style={{marginTop:30}}><h2>Тема чтения</h2></div><p className="setting-hint">Выберите оформление страниц книги. Библиотека остаётся тёмной.</p>
   <div className="theme-options settings-themes">{(['paper','white','night','oled'] as const).map(t=><button key={t} className={'theme-swatch '+(settings.theme===t?'chosen':'')} data-option={t} onClick={()=>onSettings({...settings,theme:t})}><span>{t==='paper'?'Бумага':t==='white'?'Белая':t==='night'?'Ночь':'OLED'}</span></button>)}</div>
   <BackupPanel settings={settings} onSettings={onSettings} onImported={onBackupImported}/><CloudPanel cloud={cloud}/>
  </main>}
  {loading&&<div className="import-status" role="status">Импорт книги…</div>}
  <nav className="app-tabbar" aria-label="Разделы приложения">
   <button type="button" className={tab==='library'?'active':''} aria-current={tab==='library'?'page':undefined} onClick={()=>{setTab('library');setMenu(null)}}><Icon name="book" size={25}/>Библиотека</button>
   <button type="button" className={tab==='bookmarks'?'active':''} aria-current={tab==='bookmarks'?'page':undefined} onClick={()=>{setTab('bookmarks');setMenu(null)}}><Icon name="bookmark" size={25}/>Закладки</button>
   <button type="button" className={tab==='settings'?'active':''} aria-current={tab==='settings'?'page':undefined} onClick={()=>{setTab('settings');setMenu(null)}}><Icon name="settings" size={25}/>Настройки</button>
  </nav>
 </div>;
}
