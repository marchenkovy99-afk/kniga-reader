import test from 'node:test';
import assert from 'node:assert/strict';
import {describeReadingGeometry,diagnosticSummary} from '../reader/src/reader-diagnostics.js';

test('reading diagnostics report measured on-screen space and page boundaries without book text',()=>{
 const makeRect=(top,bottom)=>({top,bottom,left:0,right:393,width:393,height:bottom-top});
 const bookText={getBoundingClientRect:()=>makeRect(81,850),querySelectorAll:()=>[{dataset:{block:'12',from:'421',to:'893'}}]};
 const current={querySelector:(selector)=>selector==='.book-text'?bookText:null};
 const stage={getBoundingClientRect:()=>makeRect(81,850)};
 const reader={getBoundingClientRect:()=>makeRect(0,852)};
 const els={'#book-stage':stage,'.reader':reader,'.book-page[aria-hidden="false"]':current};
 const doc={querySelector:(selector)=>els[selector]||null,documentElement:{clientHeight:852}};
 const win={innerHeight:852,visualViewport:{height:852},navigator:{standalone:true},getComputedStyle:()=>({lineHeight:'24px',fontSize:'22px',paddingBottom:'2px'})};
 const result=describeReadingGeometry({doc,win,glyphBounds:[{top:780,bottom:781},{top:800,bottom:804}],pageEnd:{block:12,offset:893},nextStart:{block:12,offset:893},blockType:'p'});
 assert.equal(result.stageBottom,850);
 assert.equal(result.lastGlyphBottom,804);
 assert.equal(result.emptyLines,1);
 assert.equal(result.sourceContinuous,true);
 const summary=diagnosticSummary(result);
 assert.match(summary,/нижняя граница страницы: 850/);
 assert.doesNotMatch(summary,/книга|содержание книги|преступление/i);
});
test('diagnostics identify unused space after a paragraph even when controls overlap text',()=>{
 const output=diagnosticSummary({viewportHeight:852,cssHeight:852,stageBottom:850,lastGlyphBottom:772,lineHeight:24,emptyLines:3,atParagraphEnd:true,sourceContinuous:true,blockType:'p'});
 assert.match(output,/примерно 3/);
 assert.match(output,/абзац завершён: да/);
});
