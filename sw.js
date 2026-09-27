const CACHE='rotation-iq-v7';
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting().then(()=>caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./styles.css','./app.js','./manifest.json'])))));
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));