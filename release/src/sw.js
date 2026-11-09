/* Generated per release. Books and reading state live separately in IndexedDB. */
const CACHE_PREFIX = 'libra-offline-';
const CACHE_NAME = CACHE_PREFIX + 'ac1c7ff54e78b757';
const PRECACHE_URLS = ["/assets/index-DMkgLOVA.js","/assets/index-SkfpHvwY.css","/assets/src-BLsCKbRG.js","/icon-180.png","/icon-512.png","/icon-mark.svg","/icon.svg","/manifest.webmanifest","/offline-shell.txt","/reader-touch-fix.js","/footnotes.js","/footnote-content.js","/reading-time.js","/page-turns.js","/epub-snapshot.js","/adjacent-pages.js","/book-search.js","/book-search-core.js","/book-search.css"];
const PRECACHE_HASHES = {"/assets/index-DMkgLOVA.js":"a21024d189b5c29eb1d46b9ddb206c4225df4781c7cc9d323fb51ce11e649977","/assets/index-SkfpHvwY.css":"ad3d5a1f7cf576eec0b9a0afc30814dfd9285a9cf05c94426b21eb9f80ae1fc7","/assets/src-BLsCKbRG.js":"ecc98e1c3f246e4bda7075e4df11700c955c58981287d52453413536b5342853","/icon-180.png":"cd9d28659f5e81fee3d0e62dedd4d53247fd33de33a1784b17291b3e97f4c9b3","/icon-512.png":"fe112cc2be03d21d2573d2a1e8553e3c6e8b6eb902ef2b6d0f62d140eec0d1b0","/icon-mark.svg":"479f6af96e42d0ff4a5528b4e37a1a52abb612f0529f3bb45ae207c2aa254238","/icon.svg":"c4c3d22f07e4c23f4e4393077809caf57c3cdd5330b330ceee788cee710fd58b","/manifest.webmanifest":"31bee5f2a5b712e7062e7aefb0a429cd1fdcf1e5cb99a7949303abf086a0d076","/offline-shell.txt":"3aa9e5a9c840225a259538e24dc651eb76afd3971c1f99f691d9c8cdc2c64911","/reader-touch-fix.js":"db9fa8548ce5bb021ddad7cdfa0d535536402b9db5945aa8f9b6eff1ce78cc99","/footnotes.js":"d7a7a50934cd6e9c9f5cf0a38f6f4fe09a4a1ea2cba9967d000b842813c0226f","/footnote-content.js":"2d7a1341ea4aa1e0f0c84481677616248669c511a63f739621f9678476251960","/reading-time.js":"49085e191ed8d6f3e24bc56216f30329809c0b87cc9b3fd3e1b29d4dd54fbc96","/page-turns.js":"e9c552ce831a702bae197532d0f44bc29ab884bcfa2a5a52831caec23a858d71","/epub-snapshot.js":"d492a0eca6b652ad1aecee0256d7ba4baa37cfad6d4a56365a6643eb37c46ada","/adjacent-pages.js":"d422fa8a330d9c6b61e8678436bfa83551244ca2e61250896796f5ad1f52fe31","/book-search.js":"506129fbc7a1aa1235dd728e5bc57023f84c02e98b8fb4db26e224d02431690b","/book-search-core.js":"9fc0895f547ea18bf9687309728e0986b47ac142bc5d87a0be0eaf4711d3b5fd","/book-search.css":"14c8329ecf0ab3d08dc0c0b261a0d1aab8cf48716d7eb93ec8ef362cff74ca74"};
const SCOPE = new URL(self.registration.scope);
const APP_INDEX = new URL('offline-shell.txt', SCOPE).href;
const LEGACY_INDEX = new URL('index.html', SCOPE).href;
const COMPLETE_URL = new URL('__libra_complete__',SCOPE).href;
const STATE_URL = new URL('__libra_release_state__',SCOPE).href;
const STATE_CACHE = 'libra-release-state';

async function verifiedFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),15000);
  try {
    const response = await fetch(new URL(url,SCOPE).href,{signal:controller.signal,cache:'reload'});
    if (!response.ok || response.type === 'opaque') throw new Error('Offline asset unavailable');
    const bytes = await response.clone().arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte => byte.toString(16).padStart(2,'0')).join('');
    if (hash !== PRECACHE_HASHES[url]) throw new Error('Offline asset belongs to another release');
    return response;
  } finally { clearTimeout(timer); }
}
async function completeCache(name) {
  const cache = await caches.open(name);
  const marker = await cache.match(COMPLETE_URL);
  if (marker) {
    const urls = await marker.json();
    for (const url of urls) if (!await cache.match(new URL(url,SCOPE).href)) return false;
    return true;
  }
  // One-time migration from the existing worker, which used atomic addAll().
  const index = await cache.match(APP_INDEX)||await cache.match(LEGACY_INDEX);
  if (!index) return false;
  const html = await index.text();
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map(match=>new URL(match[1],APP_INDEX).href);
  if (!assets.length) return false;
  for (const url of assets) if (!await cache.match(url)) return false;
  return true;
}
async function htmlResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('content-type','text/html; charset=utf-8');
  return new Response(await response.text(),{status:200,headers});
}
async function previousCache() {
  const saved = await (await caches.open(STATE_CACHE)).match(STATE_URL);
  if (!saved) return undefined;
  const state = await saved.json();
  return state.previous && (await caches.keys()).includes(state.previous) ? {name:state.previous,cache:await caches.open(state.previous)} : undefined;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await Promise.all(PRECACHE_URLS.map(async url => {
        try { await cache.put(new URL(url,SCOPE).href,await verifiedFetch(url)); }
        catch (error) { throw new Error(url+': '+String(error)); }
      }));
    } catch (error) {
      for (const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})) {
        client.postMessage({type:'LIBRA_OFFLINE_INSTALL_ERROR',message:String(error)});
      }
      throw error;
    }
    await cache.put(COMPLETE_URL,new Response(JSON.stringify(PRECACHE_URLS)));
    // No skipWaiting: an open book continues to use its complete old release.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const stateCache = await caches.open(STATE_CACHE);
    const saved = await stateCache.match(STATE_URL);
    const state = saved ? await saved.json() : {};
    let previous = state.active !== CACHE_NAME && keys.includes(state.active) ? state.active : state.previous;
    if (!previous) {
      const candidates=keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).reverse();
      // Legacy workers had no activation record. Prefer their complete cache;
      // a newer marked cache may only have finished installing, never running.
      for (const key of candidates) {
        if (!await (await caches.open(key)).match(COMPLETE_URL) && await completeCache(key)) { previous=key; break; }
      }
      if (!previous) for (const key of candidates) {
        if (await completeCache(key)) { previous=key; break; }
      }
    }
    await stateCache.put(STATE_URL,new Response(JSON.stringify({active:CACHE_NAME,previous})));
    await Promise.all(keys.filter(key =>
      (key.startsWith(CACHE_PREFIX)||key.startsWith('libra-shell-')) && key!==CACHE_NAME && key!==previous
    ).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (request.mode === 'navigate') {
      const shell = await cache.match(APP_INDEX);
      if (shell) return htmlResponse(shell);
      const previous = await previousCache();
      if (previous && await completeCache(previous.name)) {
        const fallback = await previous.cache.match(APP_INDEX)||await previous.cache.match(LEGACY_INDEX);
        if (fallback) return htmlResponse(fallback);
      }
      try { return await fetch(request); } catch { return Response.error(); }
    }
    const cached = await cache.match(request,{ignoreSearch:true});
    if (cached) return cached;
    if (url.pathname.startsWith(SCOPE.pathname+'assets/') && /-[\w-]+\.(?:js|css)$/.test(url.pathname)) {
      const previous = await previousCache();
      const fallback = previous && await previous.cache.match(request,{ignoreSearch:true});
      if (fallback) return fallback;
    }
    // Do not runtime-cache mutable hosting responses into this pinned release.
    try { return await fetch(request); } catch { return Response.error(); }
  })());
});
self.addEventListener('message', event => {
  if (!['LIBRA_OFFLINE_STATUS','LIBRA_REPAIR_OFFLINE'].includes(event.data?.type)||!event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      if (event.data.type === 'LIBRA_REPAIR_OFFLINE') {
        await Promise.all(PRECACHE_URLS.map(async url => {
          const absolute = new URL(url,SCOPE).href;
          if (!await cache.match(absolute)) await cache.put(absolute,await verifiedFetch(url));
        }));
      }
      const missing=[];
      for (const url of PRECACHE_URLS) if (!await cache.match(new URL(url,SCOPE).href)) missing.push(url);
      event.ports[0].postMessage({ready:missing.length===0,files:PRECACHE_URLS.length,missing,build:CACHE_NAME.slice(CACHE_PREFIX.length)});
    } catch { event.ports[0].postMessage({ready:false,files:0}); }
  })());
});
