const CACHE='libra-shell-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll([self.registration.scope])));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  event.respondWith(fetch(req).then(res=>{
    if(res.ok && new URL(req.url).pathname.startsWith(new URL(self.registration.scope).pathname)){
      const clone=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,clone)));
    }
    return res;
  }).catch(()=>caches.match(req).then(cached=>cached||(req.mode==='navigate'?caches.match(self.registration.scope):Response.error()))));
});
