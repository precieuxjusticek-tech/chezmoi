const CACHE_NAME = 'chezmoi-cache-v1.0.6'; // version incrémentée
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/image/logo_ChezMoi.png',
  '/image/logo_ChezMoi-16x16.png',
  '/image/logo_ChezMoi-32x32.png',
  '/image/logo_ChezMoi1.ico',
  '/image/partager.png',
  '/icons/chezmoi_icon256.png',
  '/icons/chezmoi_icon512.png'
];

self.addEventListener('install', event => {
  console.log('[SW] Install');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => { if (key !== CACHE_NAME) return caches.delete(key); })
    ))
  );
  self.clients.claim();
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
  });
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // ✅ TOUJOURS réseau pour les APIs — jamais de cache
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ message: "Hors ligne" }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // ✅ TOUJOURS réseau pour les images externes (Cloudinary, etc.)
  const appOrigin = self.location.origin;
  if (!request.url.startsWith(appOrigin)) {
    event.respondWith(
      fetch(request).catch(() => new Response('', { status: 408 }))
    );
    return;
  }

  // Network-first pour JS/CSS/HTML — mise à jour automatique
  if (
    request.url.endsWith('.js') ||
    request.url.endsWith('.css') ||
    request.url.endsWith('index.html') ||
    request.url.endsWith('/')
  ) {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse.clone()));
          return networkResponse.clone();
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first UNIQUEMENT pour images statiques locales
  if (request.url.includes('/image/') || request.url.includes('/icons/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse.clone()));
          return networkResponse.clone();
        });
      }).catch(() => caches.match('/image/logo_ChezMoi.png'))
    );
    return;
  }

  // Tout le reste : réseau direct, pas de cache
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

// PUSH
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || "Un nouveau bien correspond à votre alerte !",
    icon: '/icons/chezmoi_icon256.png',
    badge: '/icons/chezmoi_icon256.png',
    data: {
      annonceId: data.annonceId || null,
      typeAlerte: data.typeAlerte || "location",
      count: data.count || 1
    },
    vibrate: [200, 100, 200]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || "ChezMoi 🔔", options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const { annonceId, typeAlerte, count } = event.notification.data || {};
  const targetUrl = count === 1 && annonceId
    ? `/#annonce-${annonceId}`
    : `/#alertes-${typeAlerte}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl, typeAlerte, annonceId, count });
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});