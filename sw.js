const CACHE = 'taro-health-v11';
const FILES = ['./', './index.html', './app.js', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-192-maskable.png', './icon-512-maskable.png',
  './apple-touch-icon.png', './favicon-32.png', './cat-avatar.png', './hero_avatar.png',
  './firebase-config.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const isHTML = e.request.mode === 'navigate' || e.request.destination === 'document';
  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
  } else {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
  }
});
