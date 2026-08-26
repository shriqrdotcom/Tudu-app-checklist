/* TU DU service worker — minimal, production-safe.
 * - App shell ('/') precached at install for instant offline/warm navigations.
 * - Static hashed assets (/assets/*): cache-first (immutable content).
 * - Navigations: network-first with offline fallback to cached shell.
 * - Supabase & all cross-origin requests: NEVER cached — always network.
 * - Updates: a new worker WAITS until the user accepts the in-app update
 *   prompt (SKIP_WAITING message). No automatic reloads, no update loops.
 * - Push notifications: handles 'push' event to show notifications with deep-linking.
 */
const VERSION = 'v2';
const CACHE = `tu-du-${VERSION}`;

// VAPID public key (injected at build time via Vite define)
// This is PUBLIC info — safe to embed in the service worker.
const VAPID_PUBLIC_KEY = '__VAPID_PUBLIC_KEY__';

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

// ------------------------------------------------------------
// Push notifications: show OS notification with deep-link data
// ------------------------------------------------------------
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const { taskId, projectId, title } = payload || {};
  const notificationTitle = 'TU DU ★ Alert';
  const notificationBody = `"${title}" is due now.`;
  
  const tag = `tudu-reminder-${taskId}`;
  
  const notificationOptions = {
    body: notificationBody,
    tag,
    icon: '/brand/icons/icon-192.png',
    badge: '/brand/icons/icon-192.png',
    requireInteraction: true,
    data: { taskId, projectId },
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

// ------------------------------------------------------------
// Notification click: deep-link to the relevant task/project
// ------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { taskId, projectId } = event.notification.data || {};

  event.waitUntil(
    (async () => {
      // Try to focus existing TU DU window
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      
      for (const client of clientList) {
        if ('focus' in client) {
          // If we have task/project IDs, postMessage to navigate
          if (taskId || projectId) {
            client.postMessage({
              type: 'TUDU_OPEN_TASK',
              taskId,
              projectId,
            });
          }
          await client.focus();
          return;
        }
      }

      // No existing window — open with deep-link query params
      let url = '/';
      if (taskId || projectId) {
        const params = new URLSearchParams();
        if (taskId) params.set('task', taskId);
        if (projectId) params.set('project', projectId);
        url = `/?${params.toString()}`;
      }
      await self.clients.openWindow(url);
    })()
  );
});

// ------------------------------------------------------------
// Push subscription change: best-effort re-subscribe hint
// (App handles actual re-subscription on next load)
// ------------------------------------------------------------
self.addEventListener('pushsubscriptionchange', (event) => {
  // The subscription has expired or been revoked.
  // We can't easily re-subscribe here without the app's VAPID key.
  // The app will detect this on next load and re-subscribe.
  console.log('[TU DU] Push subscription changed:', event);
});
