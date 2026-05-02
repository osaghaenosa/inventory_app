const CACHE_NAME = 'inventory-app-v2';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/icon.svg'];

// ── Install: cache static shell ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first, cache fallback ─────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (event.request.mode === 'navigate') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('/')))
  );
});

// ── Push: Web Push API ────────────────────────────────────────────────────────
// FIX 1: Wrap in try/catch — a JSON parse error here silently kills the push
// FIX 2: Support both JSON objects and plain text payloads
self.addEventListener('push', (event) => {
  let data = { title: 'Inventory', body: '' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      // Payload was plain text, not JSON
      data = { title: 'Inventory', body: event.data.text() };
    }
  }

  const title = data.title || 'Inventory';
  const options = {
    body:    data.body || data.message || '',
    icon:    '/icon-192.png',   // FIX 3: Use PNG, not SVG — iOS & some Android ignore SVG icons
    badge:   '/icon-192.png',
    vibrate: [100, 50, 100],
    tag:     'inventory-push',
    renotify: true,
    data: { url: self.registration.scope }, // FIX 4: Store URL so click handler can navigate
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Message: triggered from the app via postMessage ──────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || 'Inventory', {
        body:     body || '',
        icon:     '/icon-192.png',
        badge:    '/icon-192.png',
        vibrate:  [100, 50, 100],
        tag:      'inventory-notification',
        renotify: true,
        data:     { url: self.registration.scope },
      })
    );
  }
});

// ── Notification click: focus or open the app ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : self.registration.scope;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        // If the app is already open, just focus it
        for (const client of list) {
          if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
