/* Levelingo service worker (GitHub Pages, scope /levelingo/). Not a full offline mode.
   - The page (navigations, index.html): network first; the cached copy is used only when the network fails
     or takes longer than 4 s, so a deploy reaches learners at once.
   - img/*: cache first (raise VERSION when an icon changes).
   - manifest and Google Fonts: stale while revalidate.
   - Everything else is left alone. The Apps Script API (POST to script.google.com) is never touched:
     only GET requests on this site or Google Fonts are handled. */
var VERSION = 'lv-sw-1';
var PAGES = VERSION + '-pages', FILES = VERSION + '-files';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('lv-sw-') === 0 && k !== PAGES && k !== FILES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(req) {
  return new Promise(function (resolve) {
    var settled = false;
    var fallback = function () { return caches.match(req, { cacheName: PAGES, ignoreSearch: true }); };
    var timer = setTimeout(function () {
      fallback().then(function (hit) { if (hit && !settled) { settled = true; resolve(hit); } });
    }, 4000);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok && res.type === 'basic') { var copy = res.clone(); caches.open(PAGES).then(function (c) { c.put(req, copy); }); }
      if (!settled) { settled = true; resolve(res); }
    }, function () {
      clearTimeout(timer);
      fallback().then(function (hit) { if (!settled) { settled = true; resolve(hit || Response.error()); } });
    });
  });
}
function cacheFirst(req) {
  return caches.match(req, { cacheName: FILES }).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(FILES).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  });
}
function staleWhileRevalidate(req) {
  return caches.open(FILES).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }, function () { return hit || Response.error(); });
      return hit || net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (fonts) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (url.origin !== self.location.origin) return;
  var base = self.registration.scope.replace(self.location.origin, '');      // "/levelingo/"
  if (url.pathname.indexOf(base) !== 0) return;
  if (req.mode === 'navigate' || url.pathname === base || url.pathname === base + 'index.html') { e.respondWith(networkFirst(req)); return; }
  if (url.pathname.indexOf(base + 'img/') === 0) { e.respondWith(cacheFirst(req)); return; }
  if (url.pathname === base + 'manifest.webmanifest') { e.respondWith(staleWhileRevalidate(req)); return; }
});
