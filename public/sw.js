// Offline support for the Next.js build.
// - /_next/static/* files are content-hashed: cache first, keep forever.
// - Pages: network first, the last copy when offline (the app shell then loads from cache).
// - /api/draws: network first, last copy when offline. Other API calls always go to the network.
const VERSION = 'pc-next-1';
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/fonts/geist-latin-wght-normal.woff2', '/fonts/geist-latin-ext-wght-normal.woff2', '/fonts/geist-mono-latin-wght-normal.woff2'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

const networkFirst = (req, fallback) => caches.open(VERSION).then((cache) => fetch(req)
  .then((r) => { if (r.ok) cache.put(req, r.clone()); return r; })
  .catch(() => cache.match(req, { ignoreSearch: true }).then((m) => m || (fallback ? cache.match(fallback) : null)).then((m) => m || Response.error())));

self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname === '/api/draws') { e.respondWith(networkFirst(req)); return; }
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.open(VERSION).then((cache) => cache.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }))));
    return;
  }
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, '/')); return; }
});
