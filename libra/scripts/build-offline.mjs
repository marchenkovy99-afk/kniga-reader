import {createHash} from 'node:crypto';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const base = process.env.LIBRA_BASE_PATH || '/';
if (!/^\/(?:[a-zA-Z0-9_\-./]*\/)?$/.test(base) || base.includes('..')) {
  throw new Error('Invalid LIBRA_BASE_PATH: expected an absolute directory path');
}
const scope = base.endsWith('/') ? base : base + '/';

async function walk(dir, prefix = '') {
  const found = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) found.push(...await walk(path.join(dir, entry.name), relative));
    else if (entry.isFile() && relative !== 'sw.js') found.push(relative);
  }
  return found;
}

const files = (await walk(dist)).sort();
if (!files.includes('index.html') || !files.some(file => /^assets\/.*\.js$/.test(file))) {
  throw new Error('Offline build requires the Vite index and JavaScript assets');
}
const urls = files.map(file => scope + file.split('/').map(encodeURIComponent).join('/'));
const digest = createHash('sha256');
for (const file of files) {
  digest.update(file + '\0');
  digest.update(createHash('sha256').update(await readFile(path.join(dist, file))).digest());
}
const buildId = digest.digest('hex').slice(0, 16);
const template = await readFile(path.join(root, 'public', 'sw.js'), 'utf8');
if (!template.includes('__LIBRA_BUILD_ID__') || !template.includes('__LIBRA_PRECACHE_LIST__')) {
  throw new Error('Service worker template placeholders are missing');
}
const worker = template
  .replaceAll('__LIBRA_BUILD_ID__', buildId)
  .replaceAll('__LIBRA_PRECACHE_LIST__', JSON.stringify(urls));
await writeFile(path.join(dist, 'sw.js'), worker);
console.log('Offline shell ' + buildId + ': precached ' + urls.length + ' local assets (' + scope + ')');
