// cache name and version for easy updates
const CACHE_NAME = 'pixel-squeeze-pwa-v1';

// list all essential files that must be cached for offline viewing
const urlsToCache = [
  './pixel_squeeze_pwa_prototype.html',
  './manifest.json',
  // materialize CSS and JS libraries
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js',
  // material Icons font stylesheet
  'https://fonts.googleapis.com/icon?family=Material+Icons'
  // Note: External placeholder images will generally not be cached unless explicitly listed.
];

// --- 1. INSTALL EVENT ---
// inits when the service worker is first installed. caches all essential assets.
self.addEventListener('install', event => {
  console.log('[Service Worker] Install Event: Starting caching...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Forces the new service worker to activate immediately
      .catch(error => {
        console.error('Failed to cache resources:', error);
      })
  );
});

// --- 2. ACTIVATE EVENT ---
// inits when the service worker is activated. cleans up old caches.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate Event: Cleaning up old caches...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// --- 3. FETCH EVENT ---
// handles all network requests. implements a cache-first, then network strategy.
self.addEventListener('fetch', event => {
  // only handle GET requests and exclude cross-origin requests that we cannot cache effectively
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 1. if resource is in cache, return the cached response (offline capability!)
        if (response) {
          return response;
        }
        
        // 2. resource not in cache, fetch from the network
        return fetch(event.request).catch(() => {
            // this is where you would serve a custom offline page if the request fails
            // for now, we just let the request.
            console.log('[Service Worker] Request failed (Offline):', event.request.url);
        });
      })
  );
});
