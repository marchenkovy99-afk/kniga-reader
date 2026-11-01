import type {ReactNode} from 'react';
import type {Block,InlineRun} from '../domain';

function InlineText({runs,onNote}:{runs:InlineRun[];onNote?:(id:string)=>void}){
 return <>{runs.map((run,index)=>{
  let content:ReactNode=run.text;
  if(run.emphasis)content=<em>{content}</em>;
  if(run.strong)content=<strong>{content}</strong>;
  if(run.strike)content=<s>{content}</s>;
  if(run.sup)content=<sup>{content}</sup>;
  if(run.sub)content=<sub>{content}</sub>;
  if(run.note)content=<button type="button" className="book-note-link" data-note={run.note} onClick={()=>onNote?.(run.note!)}>{content}</button>;
  return <span key={index}>{content}</span>;
 })}</>;
}

export function BookBlock({block,index,forceTableDialog,onMediaLoaded,onOpenTable,onOpenImage,onNote}:{block:Block;index:number;forceTableDialog:boolean;onMediaLoaded:()=>void;onOpenTable:(rows:string[][])=>void;onOpenImage?:(image:{src:string;alt:string})=>void;onNote?:(id:string)=>void}){
 const oversized=block.kind==='table'&&(forceTableDialog||block.rows.length>9||block.rows.some(row=>row.join(' ').length>300)||block.rows.flat().join(' ').length>1100);
 if(block.kind==='image')return <figure data-block-index={index} className="book-figure">{block.src?<img src={block.src} alt={block.alt||'Иллюстрация'} role="button" tabIndex={0} aria-label="Открыть иллюстрацию" onClick={()=>onOpenImage?.(block)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onOpenImage?.(block)}}} onLoad={onMediaLoaded} onError={onMediaLoaded}/>:<span className="book-image-missing" role="note">{block.alt}</span>}</figure>;
 if(block.kind==='table'){
  if(oversized)return <button data-block-index={index} className="book-table-launch" onClick={()=>onOpenTable(block.rows)}>Большая таблица · {block.rows.length} строк <span>Открыть полностью ↗</span></button>;
  return <table data-block-index={index} className="book-table"><tbody>{block.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table>;
 }
 const content=block.inline?<InlineText runs={block.inline} onNote={onNote}/>:block.text;
 if(block.kind==='heading')return <h2 data-block-index={index} className="book-heading">{content}</h2>;
 if(block.kind==='verse')return <div data-block-index={index} className="book-verse">{content}</div>;
 return <p data-block-index={index} className={'book-paragraph'+(block.listItem?' book-list-item':'')}>{content}</p>;
}
