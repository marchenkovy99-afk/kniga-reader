import {importBook} from './importer.js';
import {PRESENTATION_VERSION} from './book-presentation.js';

/** Local presentation only: synchronized source coordinates never change. */
export async function upgradeBookPresentation(book,{saveBook}){
 if(book.presentationVersion===PRESENTATION_VERSION||!book.original||!book.fileName)return false;
 try{
  const parsed=await importBook(book.original,book.fileName);
  const compatible=parsed.blocks.length===book.blocks.length&&parsed.blocks.every((fresh,i)=>{
   const old=book.blocks[i];return fresh.text===old.text&&fresh.type===old.type&&(fresh.sourceId||null)===(old.sourceId||null);
  });
  const blocks=compatible?book.blocks.map((old,i)=>({...old,html:parsed.blocks[i].html,presentation:parsed.blocks[i].presentation})):book.blocks;
  await saveBook({...book,blocks,presentationVersion:PRESENTATION_VERSION});
  // Assign presentation fields only: sync may have updated progress while saving.
  book.blocks=blocks;book.presentationVersion=PRESENTATION_VERSION;
  return compatible;
 }catch{return false;} // A legacy/corrupt original or storage failure must not stop reading.
}
