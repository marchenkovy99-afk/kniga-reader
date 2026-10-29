import {build} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(new URL('./rendered-reader.fixture.mjs',import.meta.url));
const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,lib:{entry,formats:['es']}}});
const code=(Array.isArray(result)?result[0]:result).output.find(f=>f.type==='chunk'&&f.isEntry).code;
const asset=process.argv[2].replace(/\.html$/,'.mjs');
await writeFile(asset,code);
await writeFile(process.argv[2],`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Running — rendered reader</title><style>body{font:14px/1.5 system-ui;margin:16px;display:grid;grid-template-columns:minmax(0,1fr) 395px;gap:16px;align-items:start}h1{grid-column:1/-1}pre{white-space:pre-wrap;margin:0}iframe{grid-column:2;grid-row:2;position:sticky;top:0;display:block;width:393px;height:852px;border:1px solid #bbb}</style><h1>Проверка настоящей читалки</h1><pre id="results">Запускается…</pre><iframe id="reader-frame" title="Тестовая читалка"></iframe><script type="module" src="./${asset.split('/').at(-1)}"></script></html>`);
