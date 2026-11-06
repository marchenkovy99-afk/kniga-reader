// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {selectQuoteWord} from '../quoteSelection';

it('selects the complete Russian word at the pressed character and keeps its original text',()=>{
 const root=document.createElement('article');root.textContent='Тихо светилась звезда';document.body.append(root);
 const range=document.createRange();range.setStart(root.firstChild!,8);range.collapse(true);
 const doc=document as Document&{caretRangeFromPoint?:()=>Range|null};
 const previous=doc.caretRangeFromPoint;doc.caretRangeFromPoint=()=>range;
 try{expect(selectQuoteWord(root,30,40)).toBe(true);expect(document.getSelection()?.toString()).toBe('светилась')}
 finally{doc.caretRangeFromPoint=previous;document.getSelection()?.removeAllRanges();root.remove()}
});
it('does not select text outside the active reader',()=>{
 const root=document.createElement('article'),outside=document.createTextNode('Чужой текст');document.body.append(root,outside);
 const range=document.createRange();range.setStart(outside,2);range.collapse(true);
 const doc=document as Document&{caretRangeFromPoint?:()=>Range|null};
 const previous=doc.caretRangeFromPoint;doc.caretRangeFromPoint=()=>range;
 try{expect(selectQuoteWord(root,10,10)).toBe(false)}
 finally{doc.caretRangeFromPoint=previous;root.remove();outside.remove()}
});
