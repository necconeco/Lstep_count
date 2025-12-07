/**
 * Service Worker 登録ユーティリティ
 *
 * PWA対応のためのService Worker登録と管理
 */

/**
 * Service Workerを登録
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // Service Workerがサポートされていないブラウザではスキップ
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  // 開発環境ではスキップ（ホットリロードとの競合を避ける）
  if (import.meta.env.DEV) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // 更新チェック
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新しいバージョンが利用可能
            notifyUpdate();
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('[ServiceWorker] Registration failed:', error);
    return null;
  }
}

/**
 * Service Workerを解除
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.unregister();
  } catch (error) {
    console.error('[ServiceWorker] Unregistration failed:', error);
    return false;
  }
}

/**
 * キャッシュをクリア
 */
export async function clearServiceWorkerCache(): Promise<void> {
  if (!('caches' in window)) {
    return;
  }

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
}

/**
 * 更新通知（UIで表示するためのイベント発火）
 */
function notifyUpdate(): void {
  // カスタムイベントを発火
  window.dispatchEvent(new CustomEvent('sw-update-available'));
}

/**
 * Service Workerのステータスを取得
 */
export async function getServiceWorkerStatus(): Promise<{
  supported: boolean;
  registered: boolean;
  active: boolean;
}> {
  if (!('serviceWorker' in navigator)) {
    return { supported: false, registered: false, active: false };
  }

  const registration = await navigator.serviceWorker.getRegistration();
  return {
    supported: true,
    registered: !!registration,
    active: !!registration?.active,
  };
}
