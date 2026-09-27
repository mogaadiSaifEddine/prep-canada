// Offline shell: static files are served from cache and refreshed in the background.
// API calls always go to the network.
const VERSION = 'pc-v7';
const SHELL = ['/', '/index.html', '/styles.css', '/js/main.js', '/js/ielts.js', '/js/tef.js', '/js/paths.js', '/js/pathsview.js', '/js/pathmap.js', '/js/crs.js', '/js/scoretools.js', '/manifest.webmanifest', '/icons/icon-192.png'];
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
