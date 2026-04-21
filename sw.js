// Bump this version number to force clients to update
const CACHE_VERSION = 'v15';
const CACHE_NAME = `prncpls-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/favicon.svg',
  '/DrukCond-Super-Trial.otf'
];

// Install - cache static assets only (NOT HTML files)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Take over immediately, don't wait for old tabs to close
  self.skipWaiting();
});

// Activate - nuke ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

// Fetch strategy:
// - HTML files: ALWAYS network, no cache at all
// - Supabase API: always network
// - Static assets (icons, fonts): cache-first but refreshed in background
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  if (event.request.url.includes('supabase.co')) return;

  const url = new URL(event.request.url);
  const isHTML = url.pathname === '/' ||
                 url.pathname.endsWith('.html') ||
                 event.request.destination === 'document' ||
                 event.request.mode === 'navigate';

  if (isHTML) {
    // NETWORK ONLY for HTML - never serve stale HTML
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
