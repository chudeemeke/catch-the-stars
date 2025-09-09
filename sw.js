// sw.js — cache bump for v1.1.1
const CACHE = 'catch-stars-v2.1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/engine.js',
  './js/game.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/bg-sky.png',
  './assets/bg-clouds.png',
  './assets/bg-nebula.png',
  './assets/sprites-orbs.png',
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e)=>{
  const req = e.request;
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(r=>{
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return r;
    }).catch(()=>cached))
  );
});
