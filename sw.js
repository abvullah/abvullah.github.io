/* abvullah.github.io — offline cache (stale-while-revalidate). */
'use strict';

var CACHE = 'abvullah-static-v1';
var ASSETS = [
  './',
  './index.html',
  './about.html',
  './blog.html',
  './contact.html',
  './projects.html',
  './404.html',
  './style.css',
  './favicon.svg',
  './IMG_4632.JPG'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(ASSETS); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var refresh = fetch(e.request).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        return cached || caches.match('./404.html');
      });
      return cached || refresh;
    })
  );
});
