// ============================================================
// MOCATAT - SERVICE WORKER (sw.js)
// Auto-Update Cache & Cloud Firestore Safe
// ============================================================

const CACHE_NAME = 'mocatat-cache-v65';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './riwayat.html',
    './analitik.html',
    './dompet.html',
    './target.html',
    './kategori.html',
    './lokasi.html',
    './kendaraan.html',
    './edukasi.html',
    './style.css',
    './app.js',
    './core.js',
    './fitur-beranda.js',
    './fitur-transaksi.js',
    './fitur-analitik.js',
    './fitur-kelola.js',
    './fitur-admin.js',
    './manifest.json',
    './1789744450301.png',
    './1789744567730.png'
];

// 1. INSTALL: Simpan aset inti & langsung aktifkan SW baru tanpa menunggu tab ditutup
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Gunakan allSettled agar jika ada 1 file opsional belum ada, SW tetap sukses terpasang
            await Promise.allSettled(
                ASSETS_TO_CACHE.map((url) => cache.add(url))
            );
        })
    );
});

// 2. ACTIVATE: Hapus seluruh cache versi lama secara otomatis
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. FETCH: Network-First untuk file aplikasi (agar update langsung tampil) & lewati jalur Firebase
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Hanya tangani request GET
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Jangan pernah meng-cache jalur database Cloud Firestore / Google Auth
    if (
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('firebase') ||
        url.protocol.startsWith('chrome-extension')
    ) {
        return;
    }

    // Strategi Network-First: Ambil versi terbaru dari server, simpan ke cache, atau gunakan cache jika sinyal hilang
    event.respondWith(
        fetch(req)
            .then((networkRes) => {
                if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
                    const resClone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(req, resClone);
                    });
                }
                return networkRes;
            })
            .catch(() => {
                return caches.match(req).then((cachedRes) => {
                    if (cachedRes) return cachedRes;
                    if (req.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});

// 4. DUKUNGAN KLIK NOTIFIKASI
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('./index.html');
        })
    );
});
