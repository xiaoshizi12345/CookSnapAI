
const CACHE_NAME = 'cooksnap-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Netzwerk-First Strategie für API Calls, Cache für statische Ressourcen könnte hier ergänzt werden
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
