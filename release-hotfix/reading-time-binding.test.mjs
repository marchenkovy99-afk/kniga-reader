import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('output/src/assets/index-DMkgLOVA.js',import.meta.url),'utf8');
test('actual published reader uses account owner, not its onContentTap callback',()=>{
 const start=source.indexOf('function Ao({book:'),end=source.indexOf('function jo(',start);
 const jsx=(type,props)=>({type,props});
 const scope={T:'account-owner',libraReadingOwner:()=> 'account-owner',y:{useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:()=>{}},K:{jsx,jsxs:jsx},Ra:()=>null};
 vm.runInNewContext(source.slice(start,end)+';globalThis.render=Ao',scope);
 const onContentTap=()=>true;
 const tree=scope.render({book:{id:'book-a',bookmarks:[]},settings:{animation:'none'},position:{chapter:0,page:0},progress:17,onContentTap,children:'Book text'});
 assert.equal(tree.props['data-reading-owner'],'account-owner');
});
test('actual published library uses the account owner even when its busy flag is false',()=>{
 const start=source.indexOf('function ho({cloud:'),end=source.indexOf('function go(',start);
 const jsx=(type,props)=>({type,props});const noop=()=>{};
 const scope={T:'account-owner',libraReadingOwner:()=> 'account-owner',y:{useState:value=>[value,noop],useRef:value=>({current:value}),useEffect:noop},K:{jsx,jsxs:jsx},Ra:noop,Wa:noop,co:noop,lo:noop,Qa:noop,fo:books=>books,Ia:()=>true,Fa:()=>false,mo:()=>17};
 vm.runInNewContext(source.slice(start,end)+';globalThis.render=ho',scope);
 const tree=scope.render({cloud:{hidden:false,enabled:false},books:[{id:'book-a',title:'A',author:'Author',format:'fb2',bookmarks:[],quotes:[],position:{fraction:0.17}}],settings:{},onOpen:noop});
 function find(node){if(!node||typeof node!=='object')return; if(node.props?.['data-library-book'])return node;const children=node.props?.children;for(const child of Array.isArray(children)?children:[children]){const found=Array.isArray(child)?child.map(find).find(Boolean):find(child);if(found)return found;}}
 const card=find(tree);assert.ok(card);assert.equal(card.props['data-reading-owner'],'account-owner');
});
