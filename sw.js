const VERSION = 'eo-tryit-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  const msg = event.data;
  if (msg === 'SKIP_WAITING' || (msg && msg.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  } else if (msg === 'CLEAR_CACHE' || (msg && msg.type === 'CLEAR_CACHE')) {
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => {
          if (event.source) event.source.postMessage({ type: 'CACHE_CLEARED' });
        })
    );
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations so a fresh shell is picked up when online.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Cache-first for everything else in scope.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp && resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return resp;
      });
    })
  );
});
