import { useRef, useState } from 'react';
import type { ReaderPosition, ReaderSettings, StoredBook } from '../domain';
import { bookmarkLocationLabel } from '../bookmarks';
import { BookCover } from './BookCover';
import { Icon } from './Icons';
import { sortLibraryBooks, type LibraryOrder } from '../librarySort';
type Props={books:StoredBook[]; settings:ReaderSettings; onSettings:(s:ReaderSettings)=>void;
  onOpen:(book:StoredBook,position?:ReaderPosition)=>void;onImport:(files:FileList)=>void;onDelete:(book:StoredBook)=>void;loading:boolean};
export function Library({books,settings,onSettings,onOpen,onImport,onDelete,loading}:Props){
 const input=useRef<HTMLInputElement>(null);
 const [tab,setTab]=useState<'library'|'bookmarks'|'settings'>('library');
 const [query,setQuery]=useState('');
 const [order,setOrder]=useState<LibraryOrder>('recent');
 const sorted=[...books].sort((a,b)=>(b.lastOpenedAt||b.importedAt)-(a.lastOpenedAt||a.importedAt));
 const continueBook=sorted.find(b=>b.position)||sorted[0];
 const savedPlaces=sorted.flatMap(book=>book.bookmarks.map((position,index)=>({book,position,index})));
 const shown=sortLibraryBooks(sorted.filter(b=>(b.title+' '+b.author).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))),order);
 return <div className="library-shell">
  <header className="library-header"><div><span className="brand-eyebrow">Читалка</span><h1>LIBRA</h1></div>
  <button className="round-action" title="Добавить книгу" aria-label="Добавить книгу" onClick={()=>input.current?.click()}><Icon name="plus"/></button></header>
  <input ref={input} type="file" accept=".fb2,.epub,.pdf,application/pdf" multiple hidden onChange={e=>{if(e.target.files)onImport(e.target.files);e.target.value=''}}/>
  {tab==='library'&&<main className="library-main">
    <div className="library-greeting">Ваша библиотека · FB2, EPUB и PDF</div>
    {continueBook&&<section className="continue-section">
      <div className="section-heading"><h2>Продолжить</h2></div>
      <button className="continue-card" onClick={()=>onOpen(continueBook)}>
        <BookCover book={continueBook} large/>
        <span className="continue-info"><strong>{continueBook.title}</strong><span className="continue-author">{continueBook.author}</span>
        <span className="continue-line"><span style={{width:Math.round((continueBook.position?.fraction||0)*100)+'%'}}/></span>
        <span className="continue-footer">Читать <span>→</span></span></span>
      </button>
    </section>}
    <section className="all-books">
      <div className="section-heading"><h2>Все книги <em>{books.length}</em></h2></div>
      <div className="library-filters">
       <div className="search-wrap"><Icon name="search" size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название или автор" aria-label="Поиск книг"/></div>
       <label className="library-sort-label">Сортировка
        <select aria-label="Сортировка книг" value={order} onChange={e=>setOrder(e.target.value as LibraryOrder)}>
         <option value="recent">Недавние</option>
         <option value="title">По названию</option>
         <option value="author">По автору</option>
         <option value="progress">По прогрессу</option>
        </select>
       </label>
      </div>
      {shown.length?<div className="book-grid">{shown.map(book=>
        <div key={book.id} className="book-tile"><button className="book-tile-open" onClick={()=>onOpen(book)}><BookCover book={book}/><strong>{book.title}</strong><small>{book.author}</small><span className="book-tile-meta">
         <span>{book.format.toUpperCase()}</span><span>{book.position?Math.round(Math.max(0,Math.min(1,book.position.fraction))*100)+'% прочитано':'Не начата'}</span>
        </span></button>
        <button title="Удалить книгу" className="book-remove" onClick={()=>onDelete(book)}><Icon name="trash" size={15}/></button></div>)}</div>:
        <div className="empty-library"><Icon name="book" size={38}/><strong>{books.length?'Книги не найдены':'Пока здесь тихо'}</strong><p>{books.length?'Попробуйте другой запрос.':'Добавьте первую книгу в формате FB2, EPUB или PDF.'}</p><button onClick={()=>input.current?.click()}>Добавить книгу</button></div>}
    </section>
    </main>}
  {tab==='bookmarks'&&<main className="library-main"><div className="section-heading"><h2>Закладки</h2></div>
    {savedPlaces.length?savedPlaces.map(({book,position,index})=><button className="bookmark-item" key={book.id+':'+index} onClick={()=>onOpen(book,position)}><BookCover book={book}/><span><strong>{book.title}</strong><small>{bookmarkLocationLabel(position,book.format)}</small></span></button>):
      <div className="empty-library"><Icon name="bookmark" size={40}/><strong>Пока нет закладок</strong><p>Отмечайте важные места во время чтения.</p></div>}</main>}
  {tab==='settings'&&<main className="library-main"><div className="section-heading"><h2>Оформление</h2></div>
    <p className="setting-hint">Тема меняет фон всего приложения, включая область системной строки iPhone, насколько это допускает iOS.</p>
    <div className="theme-options settings-themes">{(['paper','white','night','oled'] as const).map(t=><button key={t} className={'theme-swatch '+(settings.theme===t?'chosen':'')} data-option={t} onClick={()=>onSettings({...settings,theme:t})}><span>{t==='paper'?'Бумага':t==='white'?'Белая':t==='night'?'Ночь':'OLED'}</span></button>)}</div>
    <div className="settings-info"><Icon name="cloud" size={19}/><span>Облачная синхронизация будет подключена после проверки движка. Сейчас книги сохраняются локально на устройстве.</span></div>
  </main>}
  {loading&&<div role="status" className="import-status">Импорт книги…</div>}
  <nav className="app-tabbar"><button className={tab==='library'?'active':''} onClick={()=>setTab('library')}><Icon name="book"/>Библиотека</button><button className={tab==='bookmarks'?'active':''} onClick={()=>setTab('bookmarks')}><Icon name="bookmark"/>Закладки</button><button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}><Icon name="settings"/>Настройки</button></nav>
 </div>;
}
