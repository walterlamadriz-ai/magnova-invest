// MAGNOVA Service Worker — caches app for instant repeat visits
const CACHE = 'magnova-v1';
const ASSETS = ['/app', '/index.html'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // Only cache same-origin requests for the app HTML
  if(e.request.url.includes('/app') || e.request.url.endsWith('/index.html')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        // Return cache immediately, update in background
        var fetchPromise = fetch(e.request).then(function(response) {
          if(response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
          }
          return response;
        }).catch(function(){return cached;});
        return cached || fetchPromise;
      })
    );
  }
});
