import {copyFileSync} from 'node:fs';
for(const file of ['search-qa.html','search-qa.js','search-qa-bootstrap.js','search-fixture.epub','search-suite.html','search-suite.js'])copyFileSync(new URL('../tests/browser/'+file,import.meta.url),new URL('../src/'+file,import.meta.url));
