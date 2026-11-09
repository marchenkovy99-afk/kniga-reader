// The complete allowed delta to the preserved production core. Verification
// reverses these additions and checks the original deployment's SHA-256.
export const adapters=[
 ['element.libraFb2Preview={state:', 'element.libraFb2Preview={chapters:()=>i,position:()=>({...Le,anchor:ve.current}),settled:()=>g?!!fe.current:R&&!ie,safe:()=>!!g,resume:target=>{const page=target.anchor&&fe.current?Co(fe.current,target.anchor,{width:O.width,gap:us,stride:E||O.width+us}):null;be(page??target.page);return page??target.page},seek:async target=>{if(target.chapter!==x){M.current=target.anchor?void 0:target.page;await xe(target.chapter);if(target.anchor)ve.current={...target.anchor};return target.page}const page=target.anchor&&fe.current?Co(fe.current,target.anchor,{width:O.width,gap:us,stride:E||O.width+us}):target.page;be(page??target.page??0);if(target.anchor)ve.current={...target.anchor};return page??target.page??0},save:async target=>{const position={...Le,...target,updatedAt:Date.now()};ve.current=position.anchor;ye.current=position;await ue(e.id,position)},state:'],
 ['element.libraEpubPreview={state:', 'element.libraEpubPreview={position:()=>f.current,settled:()=>g&&!l.current&&!!s.current?.manager&&h.current===P.current&&!!i.current&&Math.abs(i.current.clientWidth-T.width)<1&&Math.abs(i.current.clientHeight-T.height)<1,navigate:async target=>{ve(()=>s.current.display(target));await p.current},state:']
];
export const searchTags='    <link rel="stylesheet" href="/book-search.css">\n    <script type="module" src="/book-search.js"></script>\n';
// Expose the library only after its displayed book records include saved progress.
export const libraryNavigationAdapters=[
 ['function b(){a(null),m()}', 'async function b(){await m();a(null)}']
];
