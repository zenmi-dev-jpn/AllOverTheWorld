// v1はアプリ本体もキャッシュ優先で返していたため、コードを更新してもスマホ側が
// 古いキャッシュを使い続けてしまう問題があった。CACHE_NAMEを変えて古いキャッシュを
// 破棄しつつ、HTML/CSS/JSはネットワーク優先（オフライン時のみキャッシュにフォールバック）
// に変更し、以後の更新が確実に反映されるようにする。
const CACHE_NAME = 'label-maker-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './lib/fabric.min.js',
  './lib/jspdf.umd.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 中身が変わらない同梱ライブラリ・アイコンだけキャッシュ優先（高速化）。
// それ以外（index.html / css / js）は毎回ネットワークから取りにいき、
// オフラインの時だけキャッシュにフォールバックする。
const CACHE_FIRST_PATTERNS = [/\/lib\//, /\/icons\//];

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const isCacheFirst = CACHE_FIRST_PATTERNS.some((re) => re.test(event.request.url));

  if (isCacheFirst) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return res;
    }).catch(() => caches.match(event.request))
  );
});
