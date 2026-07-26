/*
 * Service worker de ConectaLink Fotos.
 * Cambia APP_VERSION cuando publiques una actualización importante.
 * Solo almacena archivos estáticos de la aplicación; no intercepta Firebase.
 */
const APP_VERSION = "conectalink-fotos-v1.1.3";
const CACHE_NAME = `${APP_VERSION}-static`;
const BASE_URL = new URL("./", self.location.href);

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./firebase-config.js",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/portada-evento.jpg"
].map((path) => new URL(path, BASE_URL).href);

const STATIC_ASSET_SET = new Set(STATIC_ASSETS);
const INDEX_URL = new URL("./index.html", BASE_URL).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  // Nunca se almacenan solicitudes externas ni tráfico de Firebase.
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const normalizedUrl = new URL(requestUrl.href);
  normalizedUrl.search = "";
  normalizedUrl.hash = "";

  if (STATIC_ASSET_SET.has(normalizedUrl.href)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(INDEX_URL, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(INDEX_URL)) || (await caches.match(new URL("./", BASE_URL).href));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request, { ignoreSearch: true });

  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  const networkResponse = await networkPromise;
  return cachedResponse || networkResponse || Response.error();
}
