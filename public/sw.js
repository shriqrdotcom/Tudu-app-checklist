/* TU DU service worker — minimal, production-safe.
 * - Static hashed assets (/assets/*): cache-first (immutable content).
 * - App shell / navigations: network-first with offline fallback to cached shell.
 * - Supabase & all cross-origin requests: NEVER cached — always network.
 * - Updates: new deployments get a new VERSION → old caches purged on activate.
 *   A waiting worker activates when the user accepts the in-app update prompt
 *   (SKIP_WAITING message) or on next app launch — never an automatic reload.
 */
const VERSION = 'v1';
const CACHE = `tu-du-${VERSION}`;

self.addEventListener('install', () => {
  // No precache: the shell is network-first and assets are cached on demand.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('tu-du-') && k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cross-origin (Supabase auth/rest/storage/realtime): never intercept.
  if (url.origin !== self.location.origin) return;

  // App shell navigations: network-first so new deployments apply immediately.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cached = await caches.match(req);
          return cached || (await caches.match('/')) || Response.error();
        }
      })()
    );
    return;
  }

  // Content-hashed static assets: cache-first (safe — filename changes per build).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      })()
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
