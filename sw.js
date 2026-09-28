const CACHE='rotation-iq-v11';
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting().then(()=>caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./styles.css','./manifest.json'])))));
self.addEventListener('activate',e=>e.waitUntil(clients.claim().then(()=>caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  const isAppCode=url.pathname.endsWith('/app.js')||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/');
  if(isAppCode){
    e.respondWith(fetch(e.request).then(r=>{
      const copy=r.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy));
      return r;
    }).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});