/**
 * Sentry エラートラッキング設定
 *
 * 本番環境でのエラー監視を行います。
 * DSNは環境変数で設定してください。
 */
import * as Sentry from '@sentry/react';

/**
 * Sentryを初期化
 *
 * 注意: VITE_SENTRY_DSNが設定されていない場合は初期化をスキップします
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  // DSNが設定されていない場合はスキップ（開発環境等）
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,

    // パフォーマンスモニタリング
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // エラーサンプリング（本番は100%、開発は10%）
    sampleRate: import.meta.env.PROD ? 1.0 : 0.1,

    // リリースバージョン（package.jsonから取得）
    release: `lstep-aggregation-tool@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,

    // 機密情報のフィルタリング
    beforeSend(event) {
      // 個人情報をマスク
      if (event.extra) {
        delete event.extra.friendId;
        delete event.extra.email;
        delete event.extra.name;
      }
      return event;
    },

    // 無視するエラー（ネットワークエラーなど）
    ignoreErrors: [
      // ネットワーク関連
      'Network Error',
      'Failed to fetch',
      'Load failed',
      // ブラウザ拡張機能
      'ResizeObserver loop limit exceeded',
      // IndexedDBの一時的なエラー
      'QuotaExceededError',
    ],
  });
}

/**
 * エラーをSentryに送信
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

/**
 * メッセージをSentryに送信
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}

/**
 * ユーザー情報を設定（オプション）
 */
export function setUser(userId: string): void {
  Sentry.setUser({ id: userId });
}

/**
 * タグを追加
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

export { Sentry };
