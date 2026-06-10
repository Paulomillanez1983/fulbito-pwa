const CACHE_NAME = "fulbito-arena-v9";
const CORE_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/assets/icon.svg",
  "/assets/arena-stadium-bg-v2.webp",
  "/assets/soccer-panels.svg",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/og-image.jpg",
  "/social-preview.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const request = event.request;
  const url = new URL(request.url);

  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api") || url.pathname.startsWith("/auth"))
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        return (await caches.match("/offline")) || new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || !response.ok) return response;
        if (url.origin !== self.location.origin) return response;
        if (!["style", "script", "image", "font"].includes(request.destination)) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(async () => {
        return (await caches.match(request)) || Response.error();
      });
    })
  );
});
