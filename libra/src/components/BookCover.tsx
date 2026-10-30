import type { StoredBook } from '../domain';

/** Real art when available; otherwise a quiet typographic placeholder. */
export function BookCover({book,large=false}:{book:StoredBook;large?:boolean}){
 const initial=Array.from(book.title.trim())[0]?.toLocaleUpperCase('ru')||'•';
 return <div className={'book-cover '+(large?'book-cover-large':'')}>
  {book.cover?<img src={book.cover} loading="lazy" alt={'Обложка «'+book.title+'»'}/>:
  <div className="book-cover-generated" aria-label={'Без обложки: '+book.title}>
   <span className="book-cover-initial" aria-hidden="true">{initial}</span>
  </div>}
 </div>;
}
