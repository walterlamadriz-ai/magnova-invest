// MAGNOVA Service Worker
// Estrategia:
//  - HTML de la app (/app, /index.html, navegaciones): NETWORK-FIRST. Antes era
//    stale-while-revalidate con un CACHE nunca versionado, asi que el usuario
//    corria el build viejo una recarga extra. Network-first sirve siempre la
//    version fresca cuando hay red y cae al cache solo offline.
//  - Dependencias versionadas (Supabase/lightweight-charts por CDN, Google
//    Fonts, iconos): CACHE-FIRST. Antes NO se cacheaban, asi que offline la
//    shell cargaba pero supabase/charts/fuentes fallaban. Sus URLs son
//    inmutables/versionadas, asi que cachearlas es seguro y acelera repeticiones.
//  - Todo lo demas (incluido /api/*): passthrough — no se intercepta, va directo
//    a la red con sus parametros.
const CACHE = 'magnova-v2';
const CORE = ['/app', '/index.html'];

function isAppHtml(url) {
  return url.includes('/app') || url.endsWith('/index.html') || url.endsWith('/');
}
function isCacheableDep(url) {
  return url.includes('cdn.jsdelivr.net') ||
         url.includes('fonts.googleapis.com') ||
         url.includes('fonts.gstatic.com') ||
         /\/icon-\d+\.png(\?|$)/.test(url) ||
         url.endsWith('/apple-touch-icon.png') ||
         url.endsWith('/favicon.svg');
}

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(cache) { return cache.addAll(CORE); }));
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
  if(e.request.method !== 'GET') return;
  var url = e.request.url;

  // App HTML: network-first (fresco online, cache offline).
  if(isAppHtml(url)) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        if(response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
        }
        return response;
      }).catch(function(){
        return caches.match(e.request).then(function(c){ return c || caches.match('/index.html'); });
      })
    );
    return;
  }

  // Dependencias versionadas: cache-first con revalidacion en segundo plano.
  if(isCacheableDep(url)) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        var fetchPromise = fetch(e.request).then(function(response) {
          if(response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
          }
          return response;
        }).catch(function(){ return cached; });
        return cached || fetchPromise;
      })
    );
    return;
  }
  // Resto (incl. /api/*): sin interceptar.
});
