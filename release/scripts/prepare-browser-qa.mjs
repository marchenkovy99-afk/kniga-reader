import {copyFileSync} from 'node:fs';
for(const file of ['qa.html','qa.js','fixture.epub'])copyFileSync(new URL('../tests/browser/'+file,import.meta.url),new URL('../src/'+file,import.meta.url));
console.log('Disposable browser QA prepared; serve src and open /qa.html (390px) or /qa.html?width=430');
