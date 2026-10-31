import type {CSSProperties} from 'react';
import type {StoredBook} from '../domain';

const jacketColors=[
 {paper:'#D9C4A8',ink:'#302720'}, {paper:'#B4C2B7',ink:'#25332E'},
 {paper:'#C2B5AC',ink:'#3C2C2B'}, {paper:'#B7B7C3',ink:'#292B3B'},
 {paper:'#CCB98C',ink:'#3F3324'}
];
export function generatedJacket(title:string){
 let hash=2166136261;
 for(const char of title)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
 return jacketColors[hash%jacketColors.length];
}
export function BookCover({book,large=false}:{book:StoredBook;large?:boolean}){
 const cover=book.cover?.startsWith('data:image/')?book.cover:undefined;
 const colors=generatedJacket(book.title);
 const style={'--cover-paper':colors.paper,'--cover-ink':colors.ink} as CSSProperties;
 return <div className={'book-cover '+(large?'book-cover-large':'')}>
  {cover?<img src={cover} loading="lazy" decoding="async" alt={'Обложка «'+book.title+'»'}/>:
   <div className="book-cover-generated" style={style} aria-label={'Без обложки: '+book.title}>
    <span className="book-cover-author">{book.author==='Автор не указан'?'':book.author}</span>
    <strong className="book-cover-title">{book.title}</strong>
    <span className="book-cover-divider" aria-hidden="true"/>
   </div>}
 </div>;
}
