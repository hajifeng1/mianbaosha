/* 面包杀 Service Worker：静态资源缓存优先，网络兜底，支持离线游玩 */
var CACHE_NAME = 'mianbaosha-v20';

var CORE_ASSETS = [
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './start-bg.jpg',
  './home-background.jpg',
  './登录界面背景图.jpg',
  './1.mp4',
  './麦田流星与面包.mp4',
  './麦田流星与面包.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // 逐个添加，单个失败不阻塞安装
      return Promise.all(CORE_ASSETS.map(function(u) {
        return cache.add(u).catch(function() {});
      }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k.indexOf('mianbaosha-') === 0 && k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  // 只接管同源 GET 静态资源；POST（登录/存档等）与跨域（supabase）直接放行
  if (req.method !== 'GET') return;
  var url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // HTML/导航请求：网络优先，拿到新版本立即缓存；离线时回退旧缓存。
  // 防止缓存优先导致玩家永远停留在旧版本。
  if (req.mode === 'navigate' || /\.html?$/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(function(resp) {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put('./index.html', clone);
          });
        }
        return resp;
      }).catch(function() {
        return caches.match('./index.html');
      })
    );
    return;
  }
  // 其余静态资源（图片/视频/清单）：缓存优先，支持离线游玩
  e.respondWith(
    caches.match(req, {
      ignoreSearch: true
    }).then(function(hit) {
      if (hit) return hit;
      return fetch(req).then(function(resp) {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(req, clone);
          });
        }
        return resp;
      }).catch(function() {
        return Response.error();
      });
    })
  );
});
