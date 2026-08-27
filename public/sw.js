// Compte Rendu Service Worker
// Handles offline caching and sync queueing

// BUMP THIS on every deployment to bust cached JS/CSS
const CACHE_NAME = 'cr-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-maskable.svg',
  '/logo.svg',
];

// Install: pre-cache static assets only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: delete ALL old caches (aggressive bust)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle non-GET requests (POST/PUT/DELETE)
  if (request.method !== 'GET') {
    if (!navigator.onLine) {
      event.respondWith(queueOfflineRequest(request));
    }
    return;
  }

  // API requests: network-first (always fresh data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        });
      })
    );
    return;
  }

  // Next.js static assets (/_next/static/): cache-first with content-hash busting
  // These files have hashes in their filenames, so they're safe to cache permanently
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Next.js dynamic routes (/_next/image, /_next/data): always network-first
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => new Response('Offline', { status: 503 }))
    );
    return;
  }

  // HTML page (/): network-first, fall back to cache
  if (url.pathname === '/' || request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match('/').then((cached) => {
          if (cached) return cached;
          return new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // Other static assets (images, fonts, etc.): cache-first
  if (url.pathname.match(/\.(svg|png|jpg|ico|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Queue offline mutation requests in IndexedDB
async function queueOfflineRequest(request) {
  try {
    const body = await request.text();
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: body,
      timestamp: Date.now(),
    };

    const db = await openSyncDB();
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add(entry);
    await tx.done;

    // Notify clients about queued request
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'OFFLINE_QUEUE_UPDATED', count: 1 });
      });
    });

    return new Response(JSON.stringify({ queued: true, id: entry.id }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to queue request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Open IndexedDB for sync queue
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('cr-offline-sync', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Sync event: replay queued requests when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'cr-sync-queue') {
    event.waitUntil(replayQueue());
  }
});

// Online event: auto-sync when coming back online
self.addEventListener('online', () => {
  replayQueue();
});

// Replay all queued requests
async function replayQueue() {
  try {
    const db = await openSyncDB();
    const tx = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');
    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (all.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const entry of all) {
      try {
        const headers = new Headers(entry.headers);
        headers.delete('content-length');

        const response = await fetch(entry.url, {
          method: entry.method,
          headers: headers,
          body: entry.method !== 'GET' ? entry.body : undefined,
        });

        if (response.ok) {
          const delTx = db.transaction('queue', 'readwrite');
          delTx.objectStore('queue').delete(entry.id);
          await delTx.done;
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SYNC_COMPLETED',
          success: successCount,
          failed: failCount,
          remaining: all.length - successCount,
        });
      });
    });
  } catch (err) {
    console.error('[SW] Replay queue error:', err);
  }
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_QUEUE_COUNT') {
    openSyncDB().then((db) => {
      const tx = db.transaction('queue', 'readonly');
      return new Promise((resolve) => {
        const req = tx.objectStore('queue').count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      });
    }).then((count) => {
      event.source.postMessage({ type: 'QUEUE_COUNT', count });
    }).catch(() => {
      event.source.postMessage({ type: 'QUEUE_COUNT', count: 0 });
    });
  }

  if (event.data && event.data.type === 'FORCE_SYNC') {
    replayQueue();
  }
});
