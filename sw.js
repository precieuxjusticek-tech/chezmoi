const CACHE_NAME = 'chezmoi-cache-v5'; // incrémenter à chaque mise à jour
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
});

// FETCH - stratégie network-first pour tout sauf images statiques
self.addEventListener('fetch', event => {
  const request = event.request;

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