// Offline shell: static files are served from cache and refreshed in the background.
// API calls always go to the network.
const VERSION = 'pc-v9';
const SHELL = ['/', '/index.html', '/styles.css', '/js/main.js', '/js/ielts.js', '/js/tef.js', '/js/paths.js', '/js/pathsview.js', '/js/pathmap.js', '/js/crs.js', '/js/scoretools.js', '/js/i18n.js', '/js/i18n/fr.js', '/js/i18n/ar.js', '/js/paths.fr.js', '/js/paths.ar.js', '/js/palette.js', '/js/theme.js', '/fonts/geist-latin-wght-normal.woff2', '/fonts/geist-latin-ext-wght-normal.woff2', '/fonts/geist-mono-latin-wght-normal.woff2', '/manifest.webmanifest', '/icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'GET' && url.pathname === '/api/draws') {
    // Network first, last copy when offline
    e.respondWith(caches.open(VERSION).then((cache) => fetch(e.request).then((r) => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => cache.match(e.request).then((m) => m || Response.error()))));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => hit || cache.match('/index.html'));
    return hit || net;
  }));
});
