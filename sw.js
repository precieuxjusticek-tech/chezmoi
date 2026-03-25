// sw.js - Service Worker optimisé pour ChezMoi SPA

const CACHE_NAME = 'chezmoi-cache-v5';

const urlsToCache = [
  '/',                                // racine (important pour SPA)
  '/index.html',
  '/app.js',
  '/style.css',
  '/image/logo_ChezMoi.png',
  '/image/partager.png',
  '/icons/chezmoi_icon256.png',
  '/icons/chezmoi_icon512.png'
];

// ========================
// INSTALLATION
// ========================
self.addEventListener('install', event => {
  console.log('[SW] Installation du service worker');

  // Active immédiatement la nouvelle version
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Mise en cache des fichiers essentiels');
        return cache.addAll(urlsToCache);
      })
  );
});

// ========================
// ACTIVATION
// ========================
self.addEventListener('activate', event => {
  console.log('[SW] Service Worker activé');

  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Suppression ancien cache :', key);
            return caches.delete(key);
          }
        })
      );
    })
  );

  // Prend le contrôle immédiatement
  self.clients.claim();
});

// ========================
// INTERCEPTION DES REQUÊTES
// ========================
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {

        // Si trouvé dans le cache → renvoyer
        if (response) {
          return response;
        }

        // Sinon → chercher sur le réseau
        return fetch(event.request)
          .then(networkResponse => {
            return networkResponse;
          })
          .catch(() => {
            console.log('[SW] Offline et ressource non trouvée');
            // Optionnel : renvoyer une image de fallback pour éviter le crash
            return caches.match('/image/logo_ChezMoi.png'); // ou une autre image par défaut
          });

      })
  );
});