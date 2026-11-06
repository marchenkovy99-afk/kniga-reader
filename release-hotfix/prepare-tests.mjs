import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
await fs.mkdir(path.join(here,'e2e/support'),{recursive:true});
for(const name of await fs.readdir(here))if(name.endsWith('.spec.ts'))await fs.copyFile(path.join(here,name),path.join(here,'e2e',name));
await fs.copyFile(path.join(here,'../libra/e2e/support/epub-fixture.ts'),path.join(here,'e2e/support/epub-fixture.ts'));
