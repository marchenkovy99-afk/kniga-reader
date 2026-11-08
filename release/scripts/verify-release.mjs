import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../src/',import.meta.url),baseline=JSON.parse(readFileSync(new URL('../baseline.json',import.meta.url)));
for(const [path,hash] of Object.entries(baseline.files)){
 if(['page-turns.js','reading-time.js','sw.js','release.json'].includes(path))continue;
 assert.ok(existsSync(new URL(path,root)),path);
 assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),hash,'Production asset changed: '+path);
}
console.log('Preserved production core, typography, cloud/auth, selection and footnotes: byte-identical');
