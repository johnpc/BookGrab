/*
 * BookGrab service worker.
 *
 * Strategy:
 *  - Navigations (the app shell) are network-first with an offline fallback, so
 *    a deploy is picked up on the next load instead of being pinned to the
 *    first-ever cached HTML.
 *  - /api/* is never intercepted; search and grab results must always be live.
 *  - Hashed Next.js static assets are cache-first (immutable by construction).
 *  - Icons and the manifest are cache-first.
 *
 * Bump CACHE_VERSION whenever the caching strategy changes; old caches are
 * deleted on activate and the new worker takes over immediately.
 */
const CACHE_VERSION = "bookgrab-v2";
const PRECACHE = ["/", "/manifest.json", "/icons/icon-192x192.png", "/icons/icon-512x512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json") {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request, fallbackKey) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackKey, response.clone());
    return response;
  } catch {
    const cached = await cache.match(fallbackKey);
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
