const CACHE_NAME = "task-manager-v2";

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/pages/about.html",
  "/pages/contact.html",
  "/css/materialize.min.css",
  "/js/materialize.min.js",
  "/js/ui.js",
  "/img/task.png",
];

// Install event
self.addEventListener("install", async (event) => {
  console.log("Service worker: Installing...");
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log("Service worker: caching files");
      await cache.addAll(ASSETS_TO_CACHE);
    })()
  );
});

// Activate event
self.addEventListener("activate", async (event) => {
  console.log("Service Worker: Activating...");
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(async (cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Service Worker: Deleting old Cache");
            await caches.delete(cache);
          }
        })
      );
    })()
  );
});

// Fetch event with async/await
self.addEventListener("fetch", async (event) => {
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, networkResponse.clone()); // Update cache with the fetched response
        return networkResponse;
      } catch (error) {
        console.error("Fetch failed, returning offline page:", error);
        // Optionally, return an offline page here if available in the cache
      }
    })()
  );
});