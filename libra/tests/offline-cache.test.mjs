import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const worker = await readFile(path.join(here, '..', 'dist', 'sw.js'), 'utf8');
const scopePath = (process.env.LIBRA_BASE_PATH || '/').replace(/\/?$/, '/');
const origin = 'https://example.test';

function boot() {
  const handlers = {};
  const names = new Map([['other-application-cache', new Map()], ['libra-shell-old', new Map()]]);
  const fetched = [];
  const storeFor = name => {
    if (!names.has(name)) names.set(name, new Map());
    const entries = names.get(name);
    const keyOf = input => new URL(typeof input === 'string' ? input : input.url, origin).href;
    return {
      addAll: async urls => { assert.ok(!urls.some(url=>url.endsWith('/vercel.json')), 'Vercel hides its config: one 404 cancels the entire offline installation'); for (const url of urls) entries.set(keyOf(url), new Response('cached: ' + url)); },
      match: async (input, opts) => {
        let key = keyOf(input);
        if (opts?.ignoreSearch) key = key.split('?')[0];
        return entries.get(key);
      },
      put: async (input, response) => { entries.set(keyOf(input), response); },
    };
  };
  const self = {
    location: {origin},
    registration: {scope: origin + scopePath},
    clients: {claim: async () => {}},
    skipWaiting: async () => {},
    addEventListener: (type, fn) => { handlers[type] = fn; },
  };
  runInNewContext(worker, {
    self,
    URL,
    Response,
    caches: {
      open: async name => storeFor(name),
      keys: async () => [...names.keys()],
      delete: async name => names.delete(name),
    },
    fetch: async request => { fetched.push(request.url); throw new Error('Network unavailable'); },
  });
  const lifecycle = async name => {
    let complete;
    handlers[name]({waitUntil: promise => {complete = promise;}});
    await complete;
  };
  const request = async (url, mode = 'same-origin') => {
    let response;
    handlers.fetch({
      request: {method:'GET',url: origin + url,mode},
      respondWith: promise => {response = promise;},
      waitUntil: () => {},
    });
    return response ? await response : undefined;
  };
  const status = async () => {
    let complete, result;
    handlers.message({data:{type:'LIBRA_OFFLINE_STATUS'},ports:[{postMessage:value=>{result=value;}}],waitUntil:promise=>{complete=promise;}});
    await complete;
    return result;
  };
  return {lifecycle, request, names, fetched, status};
}

test('build precaches every shipped JS/CSS chunk, including EPUB lazy imports', async () => {
  assert.doesNotMatch(worker, /__LIBRA_(?:BUILD_ID|PRECACHE_LIST)__/);
  const app = boot();
  await app.lifecycle('install');
  const active = [...app.names.keys()].find(key => key.startsWith('libra-offline-'));
  assert.ok(active);
  const cached = [...app.names.get(active).keys()];
  assert.ok(cached.some(url => url.endsWith('/index.html')));
  assert.ok(cached.some(url => /\/assets\/.*\.js$/.test(url)));
  assert.ok(cached.some(url => /\/assets\/.*\.css$/.test(url)));
  const asset = new URL(cached.find(url => /\/assets\/.*\.js$/.test(url))).pathname;
  assert.ok(await app.request(asset));
  const offlineHome = await app.request(scopePath,'navigate');
  assert.match(await offlineHome.text(), /^cached:/);
  assert.equal(app.fetched.length, 0, 'cached app must not try blocked hosting');
  await app.lifecycle('activate');
  assert.ok(app.names.has('other-application-cache'), 'do not remove other apps caches');
  assert.ok(!app.names.has('libra-shell-old'), 'remove only old Libra cache');
});


test('deployment configuration is excluded even when packaging adds it to dist', async () => {
  const root = path.join(here,'..');
  // Leave the actual deployment config intact while ensuring it is present.
  const config=path.join(root,'dist','vercel.json');
  try { await readFile(config); } catch { await writeFile(config,'{}'); }
  execFileSync(process.execPath,[path.join(root,'scripts','build-offline.mjs')]);
  const packaged = await readFile(path.join(root,'dist','sw.js'),'utf8');
  assert.doesNotMatch(packaged,/"[^"\n]*vercel\.json"/);
});

test('offline readiness checks cached files and detects incomplete storage', async () => {
  const app=boot();
  await app.lifecycle('install');
  assert.equal((await app.status()).ready,true);
  const active=[...app.names.keys()].find(key=>key.startsWith('libra-offline-'));
  const files=app.names.get(active);
  const asset=[...files.keys()].find(url=>/\/assets\/.*\.js$/.test(url));
  files.delete(asset);
  const status=await app.status();
  assert.equal(status.ready,false);
  assert.ok(status.missing.length>0);
});
