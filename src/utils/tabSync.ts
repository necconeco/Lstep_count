/**
 * タブ間同期ユーティリティ
 *
 * BroadcastChannel APIを使用して、複数タブ間でデータ変更を同期します。
 * IndexedDBの変更を他のタブに通知し、自動的にデータを再読み込みします。
 */

// チャンネル名
const CHANNEL_NAME = 'lstep-aggregation-sync';

// メッセージタイプ
export type SyncMessageType =
  | 'DATA_CHANGED'      // データが変更された
  | 'DATA_CLEARED'      // データがクリアされた
  | 'HISTORY_UPDATED'   // 履歴が更新された
  | 'STAFF_UPDATED'     // 担当者マスタが更新された
  | 'CAMPAIGN_UPDATED'  // キャンペーンが更新された
  | 'SNAPSHOT_CREATED'  // スナップショットが作成された
  | 'BACKUP_RESTORED';  // バックアップが復元された

// 同期メッセージの型
export interface SyncMessage {
  type: SyncMessageType;
  timestamp: number;
  tabId: string;
  payload?: {
    count?: number;
    source?: string;
  };
}

// タブIDを生成（セッションごとにユニーク）
const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// BroadcastChannelインスタンス
let channel: BroadcastChannel | null = null;

// メッセージリスナーのマップ
const listeners = new Map<string, Set<(message: SyncMessage) => void>>();

/**
 * BroadcastChannelを初期化
 */
export function initTabSync(): void {
  // BroadcastChannelがサポートされていない場合はスキップ
  if (typeof BroadcastChannel === 'undefined') {
    console.warn('[TabSync] BroadcastChannel is not supported in this browser');
    return;
  }

  // 既に初期化済みの場合はスキップ
  if (channel) {
    return;
  }

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const message = event.data;

      // 自分自身からのメッセージは無視
      if (message.tabId === TAB_ID) {
        return;
      }

      // 全リスナーに通知
      const typeListeners = listeners.get(message.type);
      if (typeListeners) {
        typeListeners.forEach(listener => {
          try {
            listener(message);
          } catch (error) {
            console.error('[TabSync] Listener error:', error);
          }
        });
      }

      // ワイルドカードリスナー（'*'）にも通知
      const wildcardListeners = listeners.get('*');
      if (wildcardListeners) {
        wildcardListeners.forEach(listener => {
          try {
            listener(message);
          } catch (error) {
            console.error('[TabSync] Wildcard listener error:', error);
          }
        });
      }
    };

    channel.onmessageerror = (event) => {
      console.error('[TabSync] Message error:', event);
    };
  } catch (error) {
    console.error('[TabSync] Failed to initialize:', error);
  }
}

/**
 * 同期メッセージを送信
 */
export function broadcastSync(type: SyncMessageType, payload?: SyncMessage['payload']): void {
  if (!channel) {
    // 未初期化の場合は初期化を試みる
    initTabSync();
  }

  if (!channel) {
    return;
  }

  const message: SyncMessage = {
    type,
    timestamp: Date.now(),
    tabId: TAB_ID,
    payload,
  };

  try {
    channel.postMessage(message);
  } catch (error) {
    console.error('[TabSync] Failed to broadcast:', error);
  }
}

/**
 * 同期メッセージのリスナーを登録
 * @param type メッセージタイプ（'*'で全メッセージを受信）
 * @param listener リスナー関数
 * @returns 登録解除関数
 */
export function onSyncMessage(
  type: SyncMessageType | '*',
  listener: (message: SyncMessage) => void
): () => void {
  if (!listeners.has(type)) {
    listeners.set(type, new Set());
  }

  listeners.get(type)!.add(listener);

  // 登録解除関数を返す
  return () => {
    const typeListeners = listeners.get(type);
    if (typeListeners) {
      typeListeners.delete(listener);
      if (typeListeners.size === 0) {
        listeners.delete(type);
      }
    }
  };
}

/**
 * タブ同期をクリーンアップ
 */
export function cleanupTabSync(): void {
  if (channel) {
    channel.close();
    channel = null;
  }
  listeners.clear();
}

/**
 * 現在のタブIDを取得
 */
export function getTabId(): string {
  return TAB_ID;
}

/**
 * BroadcastChannelがサポートされているかチェック
 */
export function isBroadcastChannelSupported(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}
