const CACHE_NAME = 'chezmoi-cache-v1.0.1'; // incrémenter à chaque mise à jour
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

// INSTALLATION
self.addEventListener('install', event => {
  console.log('[SW] Install');
  self.skipWaiting(); // prendre contrôle immédiatement

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// ACTIVATION
self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();

  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
  });
});

// FETCH - stratégie network-first pour tout sauf images statiques

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // AJOUTER : exclure toutes les requêtes API du cache
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }
  

  // Ignorer les requêtes POST, PUT, DELETE — impossibles à mettre en cache
  if (request.method !== 'GET') return;

  // Forcer network-first pour fichiers critiques (JS, CSS, HTML)
  if (request.url.endsWith('.js') || request.url.endsWith('.css') || request.url.endsWith('index.html')) {
    event.respondWith(
      fetch(request).then(networkResponse => {
        caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse.clone()));
        return networkResponse.clone();
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Pour les autres (images, icônes), cache-first
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(networkResponse => {
      return caches.open(CACHE_NAME).then(cache => {
        cache.put(request, networkResponse.clone());
        return networkResponse;
      });
    })).catch(() => caches.match('/image/logo_ChezMoi.png'))
  );
});

// PUSH POUR LES ALERTES
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

  let targetUrl;
  if (count === 1 && annonceId) {
    // Une seule annonce → page détail directe
    targetUrl = `/#annonce-${annonceId}`;
  } else {
    // Plusieurs annonces → page alertes, bon onglet
    targetUrl = `/#alertes-${typeAlerte}`;
  }

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