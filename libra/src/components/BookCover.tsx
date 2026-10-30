import type { StoredBook } from '../domain';
const colors=['#283F43','#5C453B','#3B465A','#644E48','#3D4B3C','#554755'];
export function BookCover({book,large=false}:{book:StoredBook,large?:boolean}){
 const color=colors[book.title.split('').reduce((n,c)=>n+c.charCodeAt(0),0)%colors.length];
 return <div className={'book-cover '+(large?'book-cover-large':'')} style={{backgroundColor:book.cover?undefined:color}}>
 {book.cover?<img src={book.cover} loading="lazy" alt={'Обложка «'+book.title+'»'}/>:
 <div className="book-cover-generated"><small>{book.author}</small><strong>{book.title}</strong><span aria-hidden="true"></span></div>}
 </div>;
}
