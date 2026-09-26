const CACHE_NAME = 'mocatat-cache-v50';
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

// Mode Stale-While-Revalidate: Buka halaman secara instan (0.1 detik), sambil perbarui file di latar belakang
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Jangan cegat request API ke server Firebase Firestore / Google Auth
  const url = event.request.url;
  if (url.includes('firestore.googleapis.com') || url.includes('identitytoolkit.googleapis.com') || url.includes('securetoken.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      // Langsung tampilkan yang ada di memori jika tersedia agar super enteng
      return cachedResponse || fetchPromise;
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
