import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {adapters,libraryNavigationAdapters,epubOpeningAdapters,fb2MeasurementAdapters,searchTags} from './search-adapters.mjs';
const root=new URL('../src/',import.meta.url),baseline=JSON.parse(readFileSync(new URL('../baseline.json',import.meta.url)));
for(const [path,hash] of Object.entries(baseline.files)){
 if(['page-turns.js','reading-time.js','sw.js','release.json'].includes(path))continue;
 assert.ok(existsSync(new URL(path,root)),path);
 let bytes=readFileSync(new URL(path,root));
 if(path==='assets/index-DMkgLOVA.js'){
  let source=bytes.toString();for(const [before,after]of [...adapters,...libraryNavigationAdapters,...epubOpeningAdapters,...fb2MeasurementAdapters]){assert.equal(source.split(after).length,2,'Exactly one navigation adapter');source=source.replace(after,before);}bytes=Buffer.from(source);
 }
 if(['index.html','offline-shell.txt'].includes(path))bytes=Buffer.from(bytes.toString().replace(searchTags,''));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,'Unexpected production asset change: '+path);
}
console.log('Production core preserved except verified search/navigation adapters and FB2 measurement completion; cloud/auth, selection and footnotes unchanged');
