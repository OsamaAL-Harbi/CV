const CACHE_NAME = 'portfolio-v4';
const ASSETS = [
  './',
  './index.html',
  './script.js',
  './data.json',
  './manifest.json',
  './offline.html',
  './assets/icon-192.png',
  './assets/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=Roboto:wght@400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];
const DYNAMIC_CACHE = 'portfolio-dynamic-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Cache First للملفات الثابتة
  if (ASSETS.includes(url.pathname) || ASSETS.includes(e.request.url)) {
    e.respondWith(
      caches.match(e.request)
        .then(cached => cached || fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        }))
    );
    return;
  }
  // Network First مع fallback للصفحات
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./offline.html'))
    );
    return;
  }
  // باقي الطلبات
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'update-content') {
    e.waitUntil(updateCache());
  }
});
async function updateCache() {
  const cache = await caches.open(CACHE_NAME);
  return Promise.all(
    ASSETS.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch (err) { /* ignore */ }
    })
  );
}
