// MAGNOVA Service Worker
// REGLA DE ORO: solo se interceptan peticiones SAME-ORIGIN. Interceptar un
// <script> cross-origin (p.ej. el UMD de Supabase en cdn.jsdelivr.net) rompia su
// carga con "unknown error fetching the script" -> window.supabase quedaba
// undefined -> el cliente sb era null -> el login se colgaba en "Entrando...".
// Las CDNs y fuentes las maneja el navegador directamente (passthrough).
//
// Estrategia same-origin:
//  - HTML de la app (/app, /index.html, navegaciones): NETWORK-FIRST (fresco
//    online, cache offline; evita servir el build viejo una recarga extra).
//  - Iconos same-origin: CACHE-FIRST con revalidacion.
//  - Todo lo demas same-origin (incl. /api/*): passthrough.
const CACHE = 'magnova-v3';
const CORE = ['/app', '/index.html'];

function isAppHtml(path) {
  return path === '/' || path === '/app' || path.endsWith('/index.html');
}
function isCacheableAsset(path) {
  return /\/icon-\d+\.png$/.test(path) ||
         path === '/apple-touch-icon.png' ||
         path === '/favicon.svg' ||
         path === '/manifest.webmanifest';
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

  var u;
  try { u = new URL(e.request.url); } catch(err) { return; }

  // NUNCA interceptar cross-origin: CDNs (supabase, lightweight-charts), Google
  // Fonts, etc. las resuelve el navegador. Esto es lo que rompia el login.
  if(u.origin !== self.location.origin) return;

  var path = u.pathname;

  // App HTML: network-first (fresco online, cache offline).
  if(isAppHtml(path)) {
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

  // Iconos same-origin: cache-first con revalidacion en segundo plano.
  if(isCacheableAsset(path)) {
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
  // Resto same-origin (incl. /api/*): passthrough.
});
