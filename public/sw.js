// Build placeholders are filled by scripts/build-offline.mjs.
const CACHE_VERSION = "outdrawn-__BUILD_ID__";
const PRECACHE_URLS = /* __PRECACHE__ */ [];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    if (!PRECACHE_URLS.length) throw new Error("Offline manifest was not generated");
    const cache = await caches.open(CACHE_VERSION);
    try {
      // Bypass the HTTP cache so replaced artwork enters the new release.
      for (let index = 0; index < PRECACHE_URLS.length; index += 6) {
        await Promise.all(PRECACHE_URLS.slice(index, index + 6).map(async url => {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) throw new Error(`Offline asset failed: ${url}`);
          await cache.put(url, response);
        }));
      }
    } catch (error) {
      await caches.delete(CACHE_VERSION);
      throw error;
    }
    // Updates wait for explicit activation. First installation activates normally.
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("outdrawn-") && name !== CACHE_VERSION).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Keep a release's shell and assets together until the new worker activates.
  event.respondWith(cacheFirst(request, request.mode === "navigate" ? "/" : undefined));
});

async function cacheFirst(request, shellUrl) {
  const cache = await caches.open(CACHE_VERSION);
  const key = shellUrl ?? request;
  const cached = await cache.match(key);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && (shellUrl || PRECACHE_URLS.includes(new URL(request.url).pathname))) {
    await cache.put(key, response.clone());
  }
  return response;
}
