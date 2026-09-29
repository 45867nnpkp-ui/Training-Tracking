// Service Worker: macht die App offline startfähig (SPEC.md, Abschnitt 2).
// - Seiten: erst Netz (max. 4 s), sonst die zuletzt gespeicherte Version.
// - /_next/static: unveränderliche Dateien, direkt aus dem Cache.
// - GET /api/*: erst Netz, sonst Cache (z. B. Verlauf im Gym ohne Netz).
// Trainingsdaten selbst liegen in IndexedDB und werden von der App synchronisiert.

const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const API = `api-${VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, STATIC, API];
      for (const key of await caches.keys()) {
        if (!keep.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

function cacheable(response) {
  return response && response.ok && !response.redirected && response.type === "basic";
}

async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    if (cacheable(response)) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/health") return;
    event.respondWith(networkFirst(request, API, 8000));
    return;
  }
  if (request.mode === "navigate") {
    // Alle Seiten laufen über "/" (eine Seite, Ansichten intern).
    event.respondWith(
      networkFirst(request, PAGES, NETWORK_TIMEOUT_MS).catch(async () => {
        const cache = await caches.open(PAGES);
        return (await cache.match("/")) || Response.error();
      }),
    );
  }
});

// Die App schickt nach dem ersten Laden die Liste ihrer Dateien zum Cachen.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS") return;
  event.waitUntil(
    (async () => {
      for (const path of event.data.urls) {
        const cacheName = path.startsWith("/_next/static/") ? STATIC : PAGES;
        const cache = await caches.open(cacheName);
        if (await cache.match(path)) continue;
        try {
          const response = await fetch(path, { credentials: "same-origin" });
          if (cacheable(response)) await cache.put(path, response);
        } catch {
          // offline – beim nächsten Mal
        }
      }
    })(),
  );
});
