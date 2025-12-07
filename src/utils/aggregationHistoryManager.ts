/**
 * 集計履歴管理ユーティリティ
 * IndexedDBを使用して集計履歴を永続化
 */
import type { AggregationHistory } from '../types';

// IndexedDB設定
const DB_NAME = 'lstep-aggregation-db';
const HISTORY_STORE_NAME = 'aggregation-history';
const DB_VERSION = 2; // masterと別ストアなのでバージョンアップ

/**
 * IndexedDBデータベースを開く
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`IndexedDB open error: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 履歴マスタストア（Phase 5で作成済み）
      if (!db.objectStoreNames.contains('user-history-master')) {
        db.createObjectStore('user-history-master', { keyPath: 'friendId' });
      }

      // 集計履歴ストア（Phase 6で新規作成）
      if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        const historyStore = db.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'id' });
        // インデックス作成（集計月での検索を高速化）
        historyStore.createIndex('month', 'month', { unique: false });
        historyStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * すべての集計履歴を取得
 */
export async function getAllHistories(): Promise<AggregationHistory[]> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(HISTORY_STORE_NAME, 'readonly');
    const store = transaction.objectStore(HISTORY_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const histories = request.result.map(history => ({
          ...history,
          createdAt: new Date(history.createdAt),
          updatedAt: new Date(history.updatedAt),
        }));
        resolve(histories);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get all histories: ${request.error?.message}`));
      };
    });
  } catch (error) {
    console.error('getAllHistories error:', error);
    throw error;
  }
}

/**
 * 特定の月の集計履歴を取得
 *
 * @param month - 集計月（YYYY-MM形式）
 */
export async function getHistoryByMonth(month: string): Promise<AggregationHistory | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(HISTORY_STORE_NAME, 'readonly');
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const index = store.index('month');

    return new Promise((resolve, reject) => {
      const request = index.get(month);

      request.onsuccess = () => {
        if (request.result) {
          const history = {
            ...request.result,
            createdAt: new Date(request.result.createdAt),
            updatedAt: new Date(request.result.updatedAt),
          };
          resolve(history);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to get history: ${request.error?.message}`));
      };
    });
  } catch (error) {
    console.error('getHistoryByMonth error:', error);
    throw error;
  }
}

/**
 * 集計履歴を保存（新規作成または更新）
 *
 * @param history - 保存する集計履歴
 */
export async function saveHistory(history: AggregationHistory): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(HISTORY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE_NAME);

    // 更新日時を設定
    const now = new Date();
    const historyToSave = {
      ...history,
      updatedAt: now,
      // createdAtは既存レコードの場合はそのまま、新規の場合は現在時刻
      createdAt: history.createdAt || now,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(historyToSave);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to save history: ${request.error?.message}`));
      };
    });
  } catch (error) {
    console.error('saveHistory error:', error);
    throw error;
  }
}

/**
 * 集計履歴を削除
 *
 * @param id - 削除する集計ID（YYYYMM形式）
 */
export async function deleteHistory(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(HISTORY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete history: ${request.error?.message}`));
      };
    });
  } catch (error) {
    console.error('deleteHistory error:', error);
    throw error;
  }
}

/**
 * すべての集計履歴を削除（リセット機能）
 */
export async function clearAllHistories(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(HISTORY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear histories: ${request.error?.message}`));
      };
    });
  } catch (error) {
    console.error('clearAllHistories error:', error);
    throw error;
  }
}

/**
 * 最新の集計履歴を取得
 */
export async function getLatestHistory(): Promise<AggregationHistory | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(HISTORY_STORE_NAME, 'readonly');
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const index = store.index('createdAt');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, 'prev'); // 降順でカーソルを開く

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const history = {
            ...cursor.value,
            createdAt: new Date(cursor.value.createdAt),
            updatedAt: new Date(cursor.value.updatedAt),
          };
          resolve(history);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error(`Failed to get latest history: ${request.error?.message}`));
      };
    });
  } catch (error) {
    console.error('getLatestHistory error:', error);
    throw error;
  }
}
