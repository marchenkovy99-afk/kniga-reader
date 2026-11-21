/* Generated for each release by scripts/build-offline.mjs.
 * Cache the complete application shell; imported books remain in IndexedDB. */
const CACHE_PREFIX = 'libra-offline-';
const CACHE_NAME = CACHE_PREFIX + '__LIBRA_BUILD_ID__';
const PRECACHE_URLS = __LIBRA_PRECACHE_LIST__;
const SCOPE = new URL(self.registration.scope);
const APP_INDEX = new URL('index.html', SCOPE).href;

self.addEventListener('install', event => {
  // If any asset fails to download, keep the previous working offline version.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key =>
      (key.startsWith(CACHE_PREFIX) || key.startsWith('libra-shell-')) && key !== CACHE_NAME
    ).map(key => caches.delete(key)));
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
      // Cache-first prevents delays when a blocked site leaves the device 'online'.
      const shell = await cache.match(APP_INDEX);
      if (shell) return shell;
      try { return await fetch(request); } catch { return Response.error(); }
    }
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') {
        event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      }
      return response;
    } catch { return Response.error(); }
  })());
});

// Verify actual cached bytes without contacting the hosting or cloud services.
self.addEventListener('message', event => {
  if(event.data?.type !== 'LIBRA_OFFLINE_STATUS' || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const missing = [];
      for(const url of PRECACHE_URLS) if(!await cache.match(new URL(url,SCOPE).href)) missing.push(url);
      event.ports[0].postMessage({ready:missing.length===0,files:PRECACHE_URLS.length,missing});
    } catch { event.ports[0].postMessage({ready:false,files:0}); }
  })());
});
