// The complete allowed delta to the preserved production core. Verification
// reverses these additions and checks the original deployment's SHA-256.
export const adapters=[
 ['element.libraFb2Preview={state:', 'element.libraFb2Preview={chapters:()=>i,position:()=>({...Le,anchor:ve.current}),settled:()=>g?!!fe.current:R&&!ie,safe:()=>!!g,resume:target=>{const page=target.anchor&&fe.current?Co(fe.current,target.anchor,{width:O.width,gap:us,stride:E||O.width+us}):null;be(page??target.page);return page??target.page},seek:async target=>{if(target.chapter!==x){M.current=target.anchor?void 0:target.page;await xe(target.chapter);if(target.anchor)ve.current={...target.anchor};return target.page}const page=target.anchor&&fe.current?Co(fe.current,target.anchor,{width:O.width,gap:us,stride:E||O.width+us}):target.page;be(page??target.page??0);if(target.anchor)ve.current={...target.anchor};return page??target.page??0},save:async target=>{const position={...Le,...target,updatedAt:Date.now()};ve.current=position.anchor;ye.current=position;await ue(e.id,position)},state:'],
 ['element.libraEpubPreview={state:', 'element.libraEpubPreview={position:()=>f.current,settled:()=>g&&!l.current&&!!s.current?.manager&&h.current===P.current&&!!i.current&&Math.abs(i.current.clientWidth-T.width)<1&&Math.abs(i.current.clientHeight-T.height)<1,navigate:async target=>{ve(()=>s.current.display(target));await p.current},save:async target=>{const position={...f.current,...target,updatedAt:Date.now()};u.current=position.cfi;f.current=position;await ue(e.id,position)},state:']
];
export const searchTags='    <link rel="stylesheet" href="/book-search.css">\n    <script type="module" src="/book-search.js"></script>\n';
// Expose the library only after its displayed book records include saved progress.
export const libraryNavigationAdapters=[
 ['function b(){a(null),m()}', 'async function b(){await m();a(null)}']
];
// The first location report is a physical page start under provisional geometry.
// Keep the saved source target for the queued first resize; later relocations win.
export const epubOpeningAdapters=[
 ['if(!n.cfi||!c.current)return;if(u.current=n.cfi,re({...n', 'if(!n.cfi||!c.current)return;if(u.current=!g&&e.position?.cfi?e.position.cfi:n.cfi,re({...n'],
 ['cfi:n.cfi,layout:le.current?void 0:P.current,updatedAt:Date.now()', 'cfi:!g&&e.position?.cfi?e.position.cfi:n.cfi,layout:le.current?void 0:P.current,updatedAt:Date.now()']
];

// Theme-only remeasurement can finish with the same layout key. Release its
// busy state explicitly because the normal ready effect has unchanged deps.
export const fb2MeasurementAdapters=[
 ['ge.current=!1,T(o),ee(Oo(l,o)),ne(I);let u=', 'ge.current=!1,T(o),ee(Oo(l,o)),ne(I),te===I&&ae(!1);let u=']
];
