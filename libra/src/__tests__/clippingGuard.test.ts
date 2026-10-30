// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {inspectTextColumns,inspectCurrentColumn,invalidateTextColumnAudit,observeTextColumnChanges} from '../clippingGuard';
const rect=(left:number,top:number,width=80,height=20)=>({left,top,right:left+width,bottom:top+height,width,height,x:left,y:top,toJSON(){return {}}});
function fixture(rectangles:ReturnType<typeof rect>[],text='Полный текст главы'){
 const root=document.createElement('div');
 const paragraph=document.createElement('p');paragraph.dataset.blockIndex='4';paragraph.textContent=text;root.appendChild(paragraph);document.body.appendChild(root);
 vi.spyOn(root,'getBoundingClientRect').mockReturnValue(rect(10,20,300,400));
 const select=vi.fn();
 vi.spyOn(document,'createRange').mockReturnValue({selectNodeContents:select,getClientRects:()=>rectangles,detach:vi.fn()} as unknown as Range);
 return {root,paragraph,select};
}
const geometry={width:300,height:400,stride:324};
afterEach(()=>{vi.restoreAllMocks();document.body.replaceChildren()});
describe('glyph clipping guard',()=>{
 it('audits offscreen columns and fractional glyph edges without flagging valid ranges',()=>{
  const {root}=fixture([rect(10,20),rect(334,400,300.8,21),rect(10+324*100+.2,20,299.5)]);
  expect(inspectTextColumns(root,geometry)).toBeNull();
 });
 it('does not mistake a short indented line near the right edge for the next column',()=>{
  const {root}=fixture([rect(260,20,47)]);
  expect(inspectTextColumns(root,geometry)).toBeNull();
 });
 it('reports horizontal clipping of rendered glyphs even though source is still present',()=>{
  const {root}=fixture([rect(10+324*9,20,310)]);
  expect(inspectTextColumns(root,geometry)).toMatchObject({kind:'horizontal',blockIndex:4});
 });
 it('reports vertical clipping of any column',()=>{
  const {root}=fixture([rect(334,410,80,20)]);
  expect(inspectTextColumns(root,geometry)?.kind).toBe('vertical');
 });
 it('reports a negative text origin outside the visible left margin',()=>{
  const {root}=fixture([rect(5,20)]);
  expect(inspectTextColumns(root,geometry)?.kind).toBe('horizontal');
 });
 it('ignores invisible text and empty whitespace',()=>{
  const {root,paragraph,select}=fixture([rect(10,20,500)],'   ');
  expect(inspectTextColumns(root,geometry)).toBeNull();expect(select).not.toHaveBeenCalled();
  paragraph.textContent='Текст';paragraph.style.display='none';
  invalidateTextColumnAudit(root);
  expect(inspectTextColumns(root,geometry)).toBeNull();expect(select).not.toHaveBeenCalled();
 });
 it('detects a block clipping its own glyphs inside otherwise valid page bounds',()=>{
  const {root,paragraph}=fixture([rect(10,20,90,22)]);
  paragraph.style.overflow='hidden';paragraph.style.height='5px';
  vi.spyOn(paragraph,'getClientRects').mockReturnValue([rect(10,20,300,5)] as unknown as DOMRectList);
  expect(inspectTextColumns(root,geometry)?.kind).toBe('vertical');
 });
 it('supports explicit iframe page coordinates',()=>{
  const {root}=fixture([rect(0,0),rect(324,370)]);
  expect(inspectTextColumns(root,{...geometry,originLeft:0,originTop:0})).toBeNull();
 });
 it('reuses cached glyph rectangles for pure page transforms and invalidates content mutations',()=>{
  const {root,paragraph,select}=fixture([rect(10,20)]);
  root.style.transform='translateX(0px)';
  expect(inspectTextColumns(root,geometry)).toBeNull();
  root.style.transform='translateX(-324px)';
  expect(inspectTextColumns(root,geometry)).toBeNull();expect(select).toHaveBeenCalledTimes(1);
  paragraph.style.letterSpacing='12px';
  inspectTextColumns(root,geometry);expect(select).toHaveBeenCalledTimes(2);
  root.style.transform='scale(2)';
  inspectTextColumns(root,geometry);expect(select).toHaveBeenCalledTimes(3);
 });
 it('checks the real displayed origin independently of the source layout',()=>{
  const {root}=fixture([rect(10,20)]);const viewport=document.createElement('div');
  vi.spyOn(viewport,'getBoundingClientRect').mockReturnValue(rect(10,20,300,400));
  expect(inspectCurrentColumn(root,viewport,0,324)).toBeNull();
  expect(inspectCurrentColumn(root,viewport,1,324)?.kind).toBe('translation');
 });
 it('observes external paragraph geometry corruption while ignoring pure page translation',async()=>{
  const {root,paragraph}=fixture([rect(10,20)]);const changed=vi.fn();
  const stop=observeTextColumnChanges(root,changed);
  root.style.transform='translateX(-324px)';await Promise.resolve();expect(changed).not.toHaveBeenCalled();
  paragraph.style.whiteSpace='nowrap';await Promise.resolve();expect(changed).toHaveBeenCalledTimes(1);stop();
 });
});
