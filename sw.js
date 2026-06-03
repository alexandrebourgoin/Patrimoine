/* Mon patrimoine – Service Worker
   Strategy:
   - App shell (HTML, manifest, icon) → stale-while-revalidate
   - Google Fonts → cache-first (long-lived)
   - Everything else → network-first with cache fallback
*/

const CACHE = 'patrimoine-v36';
const SHELL = [
  './mon-patrimoine.html',
  './manifest.json',
  './icon.svg'
];

/* ── Install: pre-cache the app shell ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: remove stale caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* Google Fonts – cache-first (fonts don't change) */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  /* App shell files – stale-while-revalidate */
  const path = url.pathname.split('/').pop();
  if (SHELL.some(s => s.endsWith(path)) || path === '') {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  /* Everything else – network-first */
  e.respondWith(networkFirst(e.request));
});

/* ── Strategies ── */

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const resp = await fetch(req);
  if (resp.ok) {
    const c = await caches.open(CACHE);
    c.put(req, resp.clone());
  }
  return resp;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(resp => {
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  }).catch(() => null);
  return cached || fetchPromise;
}

async function networkFirst(req) {
  try {
    const resp = await fetch(req);
    if (resp.ok) {
      const c = await caches.open(CACHE);
      c.put(req, resp.clone());
    }
    return resp;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}
