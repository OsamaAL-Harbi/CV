// Service worker: offline support for the portfolio.
// Bump VERSION whenever SHELL changes so visitors drop the old caches on activate.
const VERSION = 'v4';
const CACHE_NAME = `portfolio-${VERSION}`;
const DYNAMIC_CACHE = `portfolio-dynamic-${VERSION}`;
const DYNAMIC_MAX_ENTRIES = 60;
const OFFLINE_PAGE = './offline.html';

// App shell, precached on install (relative to the worker scope, so it works under /CV/).
const SHELL = [
  './',
  './index.html',
  './offline.html',
  './script.js',
  './data.json',
  './manifest.json',
  './assets/css/tailwind.css',
  './assets/img/avatar.svg',
  './js/early.js',
  './js/analytics.js',
  './js/state.js',
  './js/utils.js',
  './js/i18n.js',
  './js/router.js',
  './js/render.js',
  './js/modal.js',
  './js/ui.js',
  './js/actions.js'
];

// Third-party hosts whose files are versioned/immutable: cache first.
const CACHE_FIRST_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(request.mode === 'navigate' ? handleNavigation(request) : networkFirst(request));
  } else if (CACHE_FIRST_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
  // Everything else (analytics, GitHub API, external images) goes straight to the network.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') self.skipWaiting();
});

async function putInCache(request, response) {
  const cache = await caches.open(DYNAMIC_CACHE);
  await cache.put(request, response);
  const keys = await cache.keys();
  if (keys.length > DYNAMIC_MAX_ENTRIES) {
    await Promise.all(keys.slice(0, keys.length - DYNAMIC_MAX_ENTRIES).map((key) => cache.delete(key)));
  }
}

// Online: always fresh from the network (so deploys show up immediately). Offline: cached copy.
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) putInCache(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" fill="#666" font-family="sans-serif">Image</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    return new Response('Not available offline', { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/plain' } });
  }
}

// Pages: network first; offline, the app itself for its own URLs and offline.html for anything else.
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) putInCache(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const scope = new URL(self.registration.scope);
    const path = new URL(request.url).pathname;
    if (path === scope.pathname || path === `${scope.pathname}index.html`) {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    return (await caches.match(OFFLINE_PAGE)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) putInCache(request, response.clone());
  return response;
}
