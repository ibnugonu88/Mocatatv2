const CACHE_NAME = 'mocatat-cache-v13';

// Daftar aset statis yang perlu di-cache
const urlsToCache = [
    './',
    './index.html',
    './riwayat.html',
    './analitik.html',
    './dompet.html',
    './kategori.html',
    './kendaraan.html',
    './target.html',
    './lokasi.html',
    './style.css',
    './app.js',
    './core.js',
    './fitur-beranda.js',
    './fitur-analitik.js',
    './fitur-kelola.js',
    './manifest.json',
    './1789744450301.png', 
    './1789744567730.png'  
];

// 1. INSTALL: Menyimpan aset ke Cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('[Service Worker] Caching App Shell');
            return cache.addAll(urlsToCache);
        })
    );
    self.skipWaiting();
});

// 2. ACTIVATE: Membersihkan Cache versi lama jika ada pembaruan
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. FETCH: Stale-While-Revalidate untuk memuat instan & update diam-diam di latar belakang
self.addEventListener('fetch', event => {
    // Biarkan request Firebase API (Firestore & Auth) langsung ke internet agar tidak kacau
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                });
                return networkResponse;
            }).catch(() => {
                console.log('[Service Worker] Offline fallback');
            });

            return cachedResponse || fetchPromise;
        })
    );
});
