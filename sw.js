/**
 * TrafficAI – Service Worker
 * Offline caching: core assets cached on install, network-first for data APIs
 */

const CACHE_NAME    = 'trafficai-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/report.html',
  '/map.html',
  '/history.html',
  '/dashboard.html',
  '/css/main.css',
  '/css/landing.css',
  '/css/report.css',
  '/css/map.css',
  '/css/history.css',
  '/css/dashboard.css',
  '/js/main.js',
  '/js/landing.js',
  '/js/report.js',
  '/js/map.js',
  '/js/history.js',
  '/js/dashboard.js',
  '/js/auth.js',
  '/js/validation.js',
  '/js/i18n.js',
  '/js/voice.js',
  '/assets/favicon.svg'
];

/* ── Install: cache static assets ───────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: clean old caches ─────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: strategy per resource type ──────────────────────────────────── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls: network only (never cache live incident data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline', message: 'You are offline. Please reconnect to submit reports.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // Firestore/Google APIs: network only
  if (url.hostname.includes('firestore') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets: cache first, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Cache successful GET responses
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
      .catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

/* ── Background sync: queue failed reports ──────────────────────────────── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-reports') {
    event.waitUntil(syncPendingReports());
  }
});

async function syncPendingReports() {
  const db = await openPendingDB();
  const reports = await db.getAll('pending');
  for (const report of reports) {
    try {
      const res = await fetch('/api/incidents/analyze', {
        method: 'POST',
        body: report.formData
      });
      if (res.ok) await db.delete('pending', report.id);
    } catch (e) {
      // Leave in queue for next sync
    }
  }
}

async function openPendingDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('trafficai-pending', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = e => {
      const db = e.target.result;
      resolve({
        getAll: store => new Promise((res, rej) => {
          const r = db.transaction(store).objectStore(store).getAll();
          r.onsuccess = () => res(r.result);
          r.onerror   = () => rej(r.error);
        }),
        delete: (store, id) => new Promise((res, rej) => {
          const r = db.transaction(store, 'readwrite').objectStore(store).delete(id);
          r.onsuccess = () => res();
          r.onerror   = () => rej(r.error);
        })
      });
    };
    req.onerror = () => reject(req.error);
  });
}
