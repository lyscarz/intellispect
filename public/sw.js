// Yo Inspect — minimal shell-cache service worker for the /m PWA.
// v1: network-first for navigations, cache-first for static assets. No
// offline submission queue (planned for v2 once we know real field
// connectivity patterns).

const SHELL_CACHE = 'yo-inspect-shell-v1';
const SHELL_PATHS = ['/m', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_PATHS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache API or Supabase calls.
  if (url.pathname.startsWith('/api/') || url.hostname.endsWith('.supabase.co')) {
    return;
  }

  // Navigation requests: network-first, fall back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/m')) ?? new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Static assets (JS/CSS/images): cache-first.
  if (/\.(?:js|css|woff2?|png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      })
    );
  }
});
