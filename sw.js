const CACHE_NAME = 'portfolio-v1';
const ASSETS = [
  './',
  './index.html',
  './script.js',
  './data.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/aos@2.3.1/dist/aos.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css',
  'https://unpkg.com/aos@2.3.1/dist/aos.js',
  'https://cdn.jsdelivr.net/npm/toastify-js'
];

// تثبيت التطبيق وتخزين الملفات
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

// تشغيل الموقع من الكاش إذا لم يوجد إنترنت
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
