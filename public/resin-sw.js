/* Olympic Resins Lead Manager — service worker (scope: /resin-leads)
   Safe by design:
   - Never intercepts non-GET (lead/visit submissions go straight to network).
   - /api/* is always network-only (never cached).
   - Navigations are network-first with an offline fallback to the cached shell.
   - Same-origin static assets are cache-first so the app opens instantly / offline. */
const CACHE = 'resin-leads-v1';
const SHELL = [
  '/resin-leads',
  '/olympic-resins-logo.svg',
  '/olympic-resins-icon-192.png',
  '/olympic-resins-icon-512.png',
  '/resin-leads.webmanifest',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // submissions untouched
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;           // API always live

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put('/resin-leads', copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match('/resin-leads'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((r) => {
        if (url.origin === self.location.origin && r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return r;
      })
    )
  );
});
