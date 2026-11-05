const CACHE_NAME = 'kana-science-v50';
const ASSETS = [
  './',
  './index.html',
  './css/style.css?v=5.0',
  './js/data.js?v=5.0',
  './js/engine.js?v=5.0',
  './js/handwriting.js?v=5.0',
  './js/app.js?v=5.0',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for HTML/CSS/JS; Cache-first for immutable neural MP3 audio clips
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const isAudio = event.request.url.includes('/audio/');
  if (isAudio) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(() => {});
          return res;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
