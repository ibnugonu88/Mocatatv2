const CACHE_NAME = 'mocatat-cache-v55';
const urlsToCache = [
  './',
  './index.html',
  './riwayat.html',
  './analitik.html',
  './dompet.html',
  './kategori.html',
  './target.html',
  './kendaraan.html',
  './lokasi.html',
  './edukasi.html',
  './admin.html',
  './style.css',
  './app.js',
  './core.js',
  './fitur-beranda.js',
  './fitur-transaksi.js',
  './fitur-admin.js',
  './fitur-analitik.js',
  './fitur-kelola.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // 1. DATA FIREBASE FIRESTORE & AUTH: 100% MURNI ONLINE (Dilarang masuk cache)
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('firebase')
  ) {
    return;
  }

  // 2. FILE TAMPILAN (HTML, CSS, JS, Font): Buka instan dari memori sambil cek pembaruan di latar belakang
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          }
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});

// Ketika Notifikasi di Status Bar Atas HP Diklik oleh User
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './index.html?open=notifikasi';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
