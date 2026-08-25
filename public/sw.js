/* TU DU service worker — minimal, production-safe.
 * - App shell ('/') precached at install for instant offline/warm navigations.
 * - Static hashed assets (/assets/*): cache-first (immutable content).
 * - Navigations: network-first with offline fallback to cached shell.
 * - Supabase & all cross-origin requests: NEVER cached — always network.
 * - Updates: a new worker WAITS until the user accepts the in-app update
 *   prompt (SKIP_WAITING message). No automatic reloads, no update loops.
 */
const VERSION = 'v2';
const CACHE = `tu-du-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await cache.add(new Request('/', { cache: 'no-cache' }));
      } catch {
        /* offline at install — navigation fallback handles it later */
      }
      // NOTE: no skipWaiting() here — the worker waits so the running page
      // stays in control. Activation happens via the user-initiated prompt.
    })()
  );
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
