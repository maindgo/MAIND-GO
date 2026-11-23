const CACHE_NAME = 'maindgo-shell-v2';
const PRECACHE_ASSETS = ['/manifest.webmanifest', '/icon.svg', '/pwa-192x192.png', '/pwa-512x512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const {request} = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests must always hit the server first so HTTP 503 maintenance locks cannot be bypassed by cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/') || Response.error())
    );
    return;
  }

  // Static app-shell assets
  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || networkFetch;
      })
    );
  }
});

self.addEventListener('message', (event) => {
  const payload = event.data;
  if (!payload || payload.type !== 'SHOW_WEATHER_NOTIFICATION') return;

  const {title, options} = payload;
  if (!title) return;

  event.waitUntil(self.registration.showNotification(title, options || {}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'WEATHER_ALERT_NOTIFICATION_CLICK',
            data,
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        const lat = typeof data.lat === 'number' ? data.lat : '';
        const lng = typeof data.lng === 'number' ? data.lng : '';
        const query = lat !== '' && lng !== '' ? `?alertLat=${lat}&alertLng=${lng}` : '/';
        return self.clients.openWindow(query);
      }
      return undefined;
    })
  );
});
