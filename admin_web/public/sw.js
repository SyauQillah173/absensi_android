/**
 * Service Worker Sistem Informasi Pondok Pesantren Qomaruddin
 * Mendukung PWA Standalone (Tanpa Playstore) & Real-time Web Push Notifications
 */

const CACHE_NAME = 'qomaruddin-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo-qomaruddin.png',
  '/manifest.webmanifest'
];

// 1. Install Event: Skip waiting untuk auto-update instan
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Caching static assets warning:', err);
      });
    })
  );
});

// 2. Activate Event: Ambil alih klien langsung dan bersihkan cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Push Event: Menerima Realtime Push Notifications dari Server
self.addEventListener('push', (event) => {
  let data = {
    title: 'Pemberitahuan Pesantren Qomaruddin',
    body: 'Ada pembaruan informasi terkini dari Pondok Pesantren Qomaruddin.',
    icon: '/logo-qomaruddin.png',
    badge: '/logo-qomaruddin.png',
    url: '/',
    tag: 'qomaruddin-general-' + Date.now()
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/logo-qomaruddin.png',
    badge: data.badge || '/logo-qomaruddin.png',
    image: data.image || undefined,
    tag: data.tag || 'qomaruddin-alert',
    renotify: true,
    vibrate: [100, 50, 100, 50, 200],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open_url',
        title: 'Buka Sekarang 📱'
      },
      {
        action: 'close_notification',
        title: 'Tutup'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// 4. Notification Click Event: Buka atau fokus ke aplikasi saat notifikasi di-tap
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close_notification') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Jika ada window/tab yang sudah terbuka, fokuskan dan navigasikan
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // Jika belum ada window terbuka, buka window baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 5. Fetch Event: Network-first untuk API & navigasi, cache fallback untuk asset
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Lewati request non-GET atau request ke API/backend
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return;
  }

  // Network First Strategy untuk menjaga aplikasi selalu terupdate realtime
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Simpan salinan ke cache jika berhasil
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback ke cache jika offline
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});
