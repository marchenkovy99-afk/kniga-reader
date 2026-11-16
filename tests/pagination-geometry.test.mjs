import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleContentFits} from '../reader/src/pagination-geometry.js';
const rect=(left,top,right,bottom)=>({left,top,right,bottom,width:right-left,height:bottom-top});
function page({textRects=[rect(12,4,188,98)],markers=[],scrollWidth=200,scrollHeight=100}={}){
 const text={data:'Весь текст'},nodes=[text];let at=0;
 return {clientWidth:200,clientHeight:100,clientLeft:1,clientTop:1,scrollWidth,scrollHeight,
  getBoundingClientRect:()=>rect(9,19,211,121),
  ownerDocument:{createTreeWalker:()=>({nextNode:()=>nodes[at++]||null}),createRange:()=>({selectNodeContents(){},getClientRects:()=>textRects.map(r=>rect(r.left+10,r.top+20,r.right+10,r.bottom+20))})},
  querySelectorAll:()=>markers.map(r=>({getBoundingClientRect:()=>rect(r.left+10,r.top+20,r.right+10,r.bottom+20)}))};
}
test('complete subpixel text can use the final visible reading row',()=>{
 assert.equal(visibleContentFits(page({textRects:[rect(8,.25,192,99.99)]})),true);
});
test('glyph overflow is rejected even when integer scroll dimensions fit',()=>{
 for(const r of [rect(8,1,192,100.25),rect(8,-.25,192,25),rect(-.25,1,192,25),rect(8,1,200.25,25)]){
  assert.equal(visibleContentFits(page({textRects:[r]})),false,JSON.stringify(r));
 }
});
test('generated page hyphens and indivisible illustration bounds must fit',()=>{
 assert.equal(visibleContentFits(page({markers:[rect(199,70,201,90)]})),false);
 assert.equal(visibleContentFits(page({markers:[rect(8,2,192,100.25)]})),false);
});
test('ordinary vertical or horizontal scroll overflow fails early',()=>{
 assert.equal(visibleContentFits(page({scrollHeight:101})),false);
 assert.equal(visibleContentFits(page({scrollWidth:201})),false);
});
test('empty trailing padding in integer scroll bounds is not mistaken for clipped glyphs',()=>{
 const el=page({scrollHeight:101,textRects:[rect(8,1,192,99)]});
 el.ownerDocument.defaultView={getComputedStyle:()=>({paddingBottom:'2px',paddingRight:'0px'})};
 assert.equal(visibleContentFits(el),true);
 const clipped=page({scrollHeight:101,textRects:[rect(8,1,192,100.25)]});
 clipped.ownerDocument.defaultView=el.ownerDocument.defaultView;
 assert.equal(visibleContentFits(clipped),false,'padding never excuses an out-of-bounds glyph');
});
test('a page that fits its old box must also fit the currently visible stage',()=>{
 const stage={clientWidth:200,clientHeight:60,clientLeft:0,clientTop:0,getBoundingClientRect:()=>rect(10,20,210,80)};
 assert.equal(visibleContentFits(page(),stage),false,'a shorter stage clips otherwise intact text');
 assert.equal(visibleContentFits(page({textRects:[rect(12,4,188,58)]}),stage),true);
});
test('rendered text must fit the browser viewport while CSS stage sizing catches up',()=>{
 const el=page(),stage={clientWidth:200,clientHeight:100,clientLeft:0,clientTop:0,getBoundingClientRect:()=>rect(10,20,210,120)};
 el.ownerDocument.defaultView={innerWidth:240,innerHeight:60};
 assert.equal(visibleContentFits(el,stage),false);
});

test('a visually clipped flipbook page is rejected even if the stage and text box are tall enough',()=>{
 const el=page({textRects:[rect(8,4,188,85)]});
 const stage={clientWidth:200,clientHeight:100,clientLeft:0,clientTop:0,getBoundingClientRect:()=>rect(10,20,210,120)};
 const clippedPage={clientWidth:200,clientHeight:50,clientLeft:0,clientTop:0,scrollWidth:200,scrollHeight:100,getBoundingClientRect:()=>rect(10,20,210,70),parentElement:stage};
 el.parentElement=clippedPage;
 el.ownerDocument.defaultView={innerWidth:240,innerHeight:200,getComputedStyle:()=>({overflowX:'hidden',overflowY:'hidden',clipPath:'none'})};
 assert.equal(visibleContentFits(el,stage),false,'a clipped page must never appear readable merely because the outer stage fits');
});
