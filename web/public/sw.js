const CACHE_NAME = 'kasir-modern-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/offline'
];

let storeId = null;
let pollingInterval = null;
const notifiedIds = new Set();

// PERSISTENCE HELPERS (using Caches API as a lightweight Key-Value store)
async function loadNotifiedIds() {
  try {
    const cache = await caches.open('notified-orders-cache');
    const response = await cache.match('/notified-ids.json');
    if (response) {
      const ids = await response.json();
      if (Array.isArray(ids)) {
        ids.forEach(id => notifiedIds.add(id));
        console.log('[SW] Loaded notified IDs:', notifiedIds.size);
      }
    }
  } catch (e) {
    console.warn('[SW] Failed to load notified IDs:', e);
  }
}

async function saveNotifiedIds() {
  try {
    const cache = await caches.open('notified-orders-cache');
    const ids = Array.from(notifiedIds).slice(-100); // keep last 100 IDs
    await cache.put('/notified-ids.json', new Response(JSON.stringify(ids), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (e) {
    console.warn('[SW] Failed to save notified IDs:', e);
  }
}

async function loadStoreId() {
  try {
    const cache = await caches.open('notified-orders-cache');
    const response = await cache.match('/store-id.json');
    if (response) {
      const data = await response.json();
      if (data && data.storeId) {
        storeId = data.storeId;
        console.log('[SW] Auto-restored Store ID:', storeId);
        startPolling();
      }
    }
  } catch (e) {
    console.warn('[SW] Failed to load store ID:', e);
  }
}

async function saveStoreId(id) {
  try {
    const cache = await caches.open('notified-orders-cache');
    await cache.put('/store-id.json', new Response(JSON.stringify({ storeId: id }), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (e) {
    console.warn('[SW] Failed to save store ID:', e);
  }
}

// BACKGROUND FIRESTORE POLLING
async function checkNewOrders() {
  if (!storeId) return;

  try {
    const url = 'https://firestore.googleapis.com/v1/projects/kasir-3d12b/databases/(default)/documents:runQuery';
    const body = {
      structuredQuery: {
        from: [{ collectionId: 'transactions' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'storeId' },
                  op: 'EQUAL',
                  value: { stringValue: storeId }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'orderStatus' },
                  op: 'EQUAL',
                  value: { stringValue: 'new' }
                }
              }
            ]
          }
        },
        limit: 10
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('REST API request failed: ' + response.statusText);
    }

    const results = await response.json();

    if (Array.isArray(results)) {
      let updated = false;

      for (const item of results) {
        if (!item.document) continue;

        const doc = item.document;
        const transactionId = doc.name.split('/').pop();
        const fields = doc.fields;

        if (!transactionId || !fields) continue;

        // Skip if already processed
        if (notifiedIds.has(transactionId)) {
          continue;
        }

        // Parse fields
        const total = fields.total?.integerValue 
          ? parseInt(fields.total.integerValue) 
          : (fields.total?.doubleValue ? parseFloat(fields.total.doubleValue) : 0);

        const customerName = fields.customerName?.stringValue || 'Pelanggan';

        // Filter out ancient transactions (e.g. older than 15 minutes)
        const timestampStr = fields.timestamp?.timestampValue;
        if (timestampStr) {
          const txTime = new Date(timestampStr);
          const now = new Date();
          if (now.getTime() - txTime.getTime() > 15 * 60 * 1000) {
            notifiedIds.add(transactionId);
            updated = true;
            continue;
          }
        }

        const totalStr = total ? `Rp ${total.toLocaleString('id-ID')}` : '';

        // Trigger native notification
        self.registration.showNotification('🚨 PESANAN BARU MASUK!', {
          body: `Ada pesanan online dari ${customerName} senilai ${totalStr}. Klik untuk memproses!`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [0, 500, 250, 500],
          tag: transactionId,
          requireInteraction: true,
          data: { url: `/orders?id=${transactionId}` }
        });

        notifiedIds.add(transactionId);
        updated = true;
      }

      if (updated) {
        saveNotifiedIds();
      }
    }
  } catch (error) {
    console.error('[SW] Error polling Firestore:', error);
  }
}

function startPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  // Run check immediately
  checkNewOrders();
  // Check every 30 seconds
  pollingInterval = setInterval(checkNewOrders, 30000);
}

// SERVICE WORKER LIFECYCLE EVENTS
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => 
          cache.add(url).catch(err => console.warn(`Failed to cache ${url}:`, err))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      loadNotifiedIds(),
      loadStoreId(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== 'notified-orders-cache') {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ]).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const url = new URL(event.request.url);
        if (url.origin === self.location.origin) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          }).catch(e => console.warn("Cache put failed:", e));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/offline');
          }
        });
      })
  );
});

// MESSAGING INTERFACE
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_STORE_ID') {
    storeId = event.data.storeId;
    console.log('[SW] Store ID registered in SW:', storeId);
    saveStoreId(storeId);
    startPolling();
  }
});

// PUSH RECEIVER (Fallback for external server push)
self.addEventListener('push', (event) => {
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }

  const data = event.data ? event.data.json() : {};
  const title = data.title || 'IKASIR PRO Notification';
  const options = {
    body: data.body || 'Ada aktivitas baru di toko Anda.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'general-notification',
    data: data,
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Direct user to orders tab or specific order if url provided in notification data
      const destinationUrl = event.notification.data?.url || '/';
      
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(destinationUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(destinationUrl);
      }
    })
  );
});
