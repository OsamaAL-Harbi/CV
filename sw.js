const CACHE_NAME = 'portfolio-v2'; // قمنا بتغيير الإصدار لتحديث الكاش
const ASSETS = [
  './',
  './index.html',
  './script.js',
  './data.json',
  './manifest.json'
  // حذفنا الروابط الخارجية لتجنب مشاكل CORS
];

// 1. التثبيت (Install) - تخزين ملفاتك الأساسية فقط
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); // تفعيل الخدمة فوراً
});

// 2. التفعيل (Activate) - تنظيف الكاش القديم
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// 3. الجلب (Fetch) - استراتيجية ذكية (Network First)
// يحاول الاتصال بالإنترنت أولاً، إذا فشل يعرض النسخة المحفوظة
self.addEventListener('fetch', (e) => {
  // تجاهل الطلبات غير الآمنة أو الخارجية المعقدة
  if (!e.request.url.startsWith(self.location.origin) && e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // إذا نجح الاتصال، انسخ الملف للكاش للمرة القادمة
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // نستخدم put بدلاً من addAll لتجنب أخطاء CORS
          if (e.request.url.startsWith('http')) {
             cache.put(e.request, resClone).catch(() => {}); 
          }
        });
        return res;
      })
      .catch(() => {
        // إذا انقطع النت، هات الملف من الكاش
        return caches.match(e.request);
      })
  );
});
