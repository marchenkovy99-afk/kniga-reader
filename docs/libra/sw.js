/* Generated for each release by scripts/build-offline.mjs.
 * Cache the complete application shell; imported books remain in IndexedDB. */
const CACHE_PREFIX = 'libra-offline-';
const CACHE_NAME = CACHE_PREFIX + '20e19d221703f189';
const PRECACHE_URLS = ["/kniga-reader/libra/assets/index-BxF6atfl.js","/kniga-reader/libra/assets/index-DlZ_07KR.css","/kniga-reader/libra/assets/src-YqWr7uO4.js","/kniga-reader/libra/icon-180.png","/kniga-reader/libra/icon-512.png","/kniga-reader/libra/icon-mark.svg","/kniga-reader/libra/icon.svg","/kniga-reader/libra/index.html","/kniga-reader/libra/manifest.webmanifest"];
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
