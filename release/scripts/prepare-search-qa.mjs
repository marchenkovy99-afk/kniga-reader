import {copyFileSync} from 'node:fs';
for(const file of ['search-qa.html','search-qa.js','search-qa-bootstrap.js','search-fixture.epub'])copyFileSync(new URL('../tests/browser/'+file,import.meta.url),new URL('../src/'+file,import.meta.url));
