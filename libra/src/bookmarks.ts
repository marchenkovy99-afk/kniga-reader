import type {ReaderPosition} from './domain';

/** The exact document location of a saved bookmark. */
export function sameBookmark(a:ReaderPosition,b:ReaderPosition):boolean{
 if(a.cfi||b.cfi)return Boolean(a.cfi&&b.cfi&&a.cfi===b.cfi);
 if(a.chapter!==b.chapter)return false;
 if(a.anchor&&b.anchor&&a.anchor.block===b.anchor.block&&
    a.anchor.textNode===b.anchor.textNode&&a.anchor.offset===b.anchor.offset)return true;
 // Bookmarks are page markers. For reading a book with unchanged typography,
 // the page number is still the most useful quick indicator.
 return a.page===b.page;
}
export function bookmarkLocationLabel(position:ReaderPosition,format:'fb2'|'epub'|'pdf'):string{
 if(format==='pdf')return 'Страница '+(position.page+1);
 if(format==='epub')return 'Место чтения · EPUB';
 return 'Глава '+(position.chapter+1)+' · страница '+(position.page+1);
}
