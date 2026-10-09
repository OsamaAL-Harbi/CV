const CACHE_NAME = 'portfolio-v4';
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './script.js',
  './data.json',
  './manifest.json'
];

// تقليل عمر الكاش للبيانات الديناميكية
const DYNAMIC_CACHE = 'portfolio-dynamic-v4';
const OFFLINE_PAGE = './offline.html';

self.addEventListener('install', (e) => {
  console.log('[Service Worker] Installing...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Activating...');
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // تجاهل الطلبات غير GET
  if (e.request.method !== 'GET') return;
  
  // استثناء الطلبات الخارجية المحددة
  const isExternal = !e.request.url.startsWith(self.location.origin);
  const url = new URL(e.request.url);
  
  // استراتيجيات مختلفة لأنواع الملفات
  if (isExternal) {
    // للخطوط وأيقونات font-awesome - Cache First
    if (url.href.includes('fonts.googleapis.com') || url.href.includes('font-awesome')) {
      e.respondWith(
        caches.match(e.request)
          .then(cached => cached || fetch(e.request)
            .then(response => {
              const clone = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then(cache => cache.put(e.request, clone));
              return response;
            })
          )
      );
      return;
    }
  }
  
  // للملفات المحلية - Network First مع fallback
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // تحديث الكاش (الردود الناجحة فقط)
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // البحث في الكاش
        return caches.match(e.request)
          .then(cached => {
            if (cached) return cached;
            
            // للصفحات الرئيسية
            if (e.request.mode === 'navigate') {
              return caches.match('./index.html')
                .then(page => page || caches.match(OFFLINE_PAGE));
            }
            
            // رد افتراضي للصور
            if (e.request.destination === 'image') {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" fill="#666" font-family="sans-serif">Image</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            
            return new Response('Not available offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });
      })
  );
});

// إضافة حدث للرسائل من الصفحة
self.addEventListener('message', (e) => {
  if (e.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// تحديث التطبيق في الخلفية
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'update-content') {
    console.log('[Service Worker] Periodic sync for updates');
    e.waitUntil(updateCache());
  }
});

async function updateCache() {
  const cache = await caches.open(CACHE_NAME);
  return Promise.all(
    ASSETS.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (err) {
        console.log(`Failed to update ${url}:`, err);
      }
    })
  );
}
