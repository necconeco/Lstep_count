/**
 * Service Worker - オフライン対応とキャッシュ管理
 *
 * IndexedDBのデータはブラウザに保存されるため、
 * アプリ自体もオフラインで動作できるようにする
 */

const CACHE_NAME = 'lstep-aggregation-v1';
const STATIC_CACHE_NAME = 'lstep-static-v1';

// キャッシュするアセット
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// インストール時にキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // 新しいService Workerを即座にアクティブ化
  self.skipWaiting();
});

// アクティベーション時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // すべてのクライアントで即座に制御開始
  self.clients.claim();
});

// フェッチリクエストのハンドリング
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 同一オリジンのリクエストのみ処理
  if (url.origin !== location.origin) {
    return;
  }

  // ナビゲーションリクエスト（HTMLページ）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 成功したらキャッシュを更新
          const responseClone = response.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // オフライン時はキャッシュから返す
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 静的アセット（JS, CSS, 画像など）
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // キャッシュがあればそれを返しつつ、バックグラウンドで更新
          fetch(request).then((response) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response);
            });
          });
          return cachedResponse;
        }

        // キャッシュがなければフェッチしてキャッシュ
        return fetch(request).then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        });
      })
    );
    return;
  }
});

// バックグラウンド同期（将来の拡張用）
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    // データ同期処理（必要に応じて実装）
  }
});
