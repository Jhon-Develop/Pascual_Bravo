/**
 * Pazito production service worker.
 *
 * Privacy rule: this worker may cache the public shell and versioned static
 * assets only. API responses and authenticated/navigation responses are never
 * written to Cache Storage. Business data belongs in IndexedDB with the
 * explicit offline queue, not in the HTTP cache.
 */

const CACHE_NAME = 'pazito-static-v2';
const CACHE_PREFIX = 'pazito-';
const STATIC_ASSETS = [
  '/',
  '/app/',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache each asset independently so one missing optional icon doesn't
      // prevent the service worker from installing at all.
      await Promise.all(
        STATIC_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { cache: 'reload' });
            if (response.ok) await cache.put(asset, response);
          } catch {
            // Optional asset; the app shell can still be installed.
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API responses: they may include personal or financial data.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => jsonUnavailableResponse()));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStaticAsset(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationFallback(request));
    return;
  }

  // Other same-origin GETs are network-only unless explicitly recognized as
  // static files above. This avoids accidentally caching private HTML/data.
  event.respondWith(fetch(request).catch(() => new Response('Sin conexión', { status: 503 })));
});

async function cacheFirstStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaque') {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Recurso no disponible sin conexión', { status: 503 });
  }
}

async function navigationFallback(request) {
  try {
    // Network-first, but importantly do not cache the response. In particular,
    // /auth/* and future account pages must not be persisted by this worker.
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const url = new URL(request.url);
    if (url.pathname === '/') {
      const home = await cache.match('/');
      if (home) return home;
    }
    if (url.pathname === '/app' || url.pathname === '/app/') {
      const appShell = await cache.match('/app/');
      if (appShell) return appShell;
    }

    const offlinePage = await cache.match('/offline.html');
    if (offlinePage) return offlinePage;

    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_astro/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/icons/') ||
    /\.(?:js|css|png|jpe?g|webp|svg|woff2?|ico|webmanifest)$/.test(pathname)
  );
}

function jsonUnavailableResponse() {
  return new Response(
    JSON.stringify({
      code: 'OFFLINE',
      message: 'No hay conexión. Los cambios pendientes se sincronizarán cuando vuelva la conexión.',
      statusCode: 503,
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }
  );
}
