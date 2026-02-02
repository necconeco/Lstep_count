/**
 * Infrastructure層 - マスターデータリポジトリ
 * IndexedDB入出力（2系統ストア: フル履歴マスター / 実施マスター）
 */

import type { FullHistoryMaster, ImplementationMaster } from '../domain';

const DB_NAME = 'lstep-aggregation-db';
const DB_VERSION = 3; // バージョン3に変更（2系統ストア対応）

// ストア名
const FULL_HISTORY_STORE = 'full-history-master';
const IMPLEMENTATION_STORE = 'implementation-master';

// 旧ストア名（マイグレーション用、将来実装予定）
// const LEGACY_STORE = 'user-history-master';

// ============================================================================
// データベース初期化
// ============================================================================

/**
 * IndexedDBの初期化
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('お使いのブラウザはIndexedDBをサポートしていません'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = event => {
      console.error('[openDatabase] IndexedDB open error:', request.error);
      console.error('[openDatabase] Error event:', event);
      reject(new Error(`IndexedDBを開けませんでした: ${request.error?.message || '不明なエラー'}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;

      // フル履歴マスターストア
      if (!db.objectStoreNames.contains(FULL_HISTORY_STORE)) {
        const fullStore = db.createObjectStore(FULL_HISTORY_STORE, { keyPath: 'friendId' });
        fullStore.createIndex('lastImplementationDate', 'lastImplementationDate', { unique: false });
        fullStore.createIndex('totalRecordCount', 'totalRecordCount', { unique: false });
      }

      // 実施マスターストア
      if (!db.objectStoreNames.contains(IMPLEMENTATION_STORE)) {
        const implStore = db.createObjectStore(IMPLEMENTATION_STORE, { keyPath: 'friendId' });
        implStore.createIndex('lastImplementationDate', 'lastImplementationDate', { unique: false });
        implStore.createIndex('implementationCount', 'implementationCount', { unique: false });
      }

      // 旧ストアは削除せず残す（データ移行の可能性のため）
    };

    request.onblocked = () => {
      console.warn('[openDatabase] IndexedDB open blocked - 他のタブでデータベースが開かれています');
    };
  });
}

// ============================================================================
// Date変換ヘルパー
// ============================================================================

/**
 * IndexedDBから取得したデータのDate型を復元
 */
function restoreDates<T extends { createdAt: Date | string; updatedAt: Date | string }>(record: T): T {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

/**
 * FullHistoryMasterのDate型を復元
 */
function restoreFullHistoryMaster(record: FullHistoryMaster): FullHistoryMaster {
  return {
    ...restoreDates(record),
    lastImplementationDate: record.lastImplementationDate ? new Date(record.lastImplementationDate) : null,
    records: record.records.map(r => ({
      ...r,
      date: new Date(r.date),
    })),
  };
}

/**
 * ImplementationMasterのDate型を復元
 */
function restoreImplementationMaster(record: ImplementationMaster): ImplementationMaster {
  return {
    ...restoreDates(record),
    lastImplementationDate: record.lastImplementationDate ? new Date(record.lastImplementationDate) : null,
    records: record.records.map(r => ({
      ...r,
      date: new Date(r.date),
    })),
  };
}

// ============================================================================
// フル履歴マスター操作
// ============================================================================

/**
 * 全フル履歴マスターを取得
 */
export async function getAllFullHistoryMasters(): Promise<Map<string, FullHistoryMaster>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([FULL_HISTORY_STORE], 'readonly');
    const objectStore = transaction.objectStore(FULL_HISTORY_STORE);
    const request = objectStore.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const data = new Map<string, FullHistoryMaster>();
        (request.result as FullHistoryMaster[]).forEach(record => {
          data.set(record.friendId, restoreFullHistoryMaster(record));
        });
        resolve(data);
      };

      request.onerror = () => {
        reject(new Error('フル履歴マスターの取得に失敗しました'));
      };
    });
  } catch (error) {
    console.error('getAllFullHistoryMasters error:', error);
    return new Map();
  }
}

/**
 * フル履歴マスターを一括保存
 */
export async function saveFullHistoryMastersBatch(masters: Map<string, FullHistoryMaster>): Promise<void> {
  if (masters.size === 0) return;

  try {
    const db = await openDatabase();
    const transaction = db.transaction([FULL_HISTORY_STORE], 'readwrite');
    const objectStore = transaction.objectStore(FULL_HISTORY_STORE);

    return new Promise((resolve, reject) => {
      let errorOccurred = false;

      masters.forEach((record, key) => {
        try {
          const request = objectStore.put(record);
          request.onerror = () => {
            errorOccurred = true;
            console.error(`[saveFullHistoryMastersBatch] put error for ${key}:`, request.error);
          };
        } catch (error) {
          errorOccurred = true;
          console.error(`[saveFullHistoryMastersBatch] Exception for ${key}:`, error);
        }
      });

      transaction.oncomplete = () => {
        if (errorOccurred) {
          reject(new Error('一部のフル履歴マスターの保存に失敗しました'));
        } else {
          resolve();
        }
      };

      transaction.onerror = () => {
        reject(new Error(`フル履歴マスターの一括保存に失敗しました: ${transaction.error?.message}`));
      };

      transaction.onabort = () => {
        reject(new Error(`トランザクションが中断されました: ${transaction.error?.message}`));
      };
    });
  } catch (error) {
    console.error('[saveFullHistoryMastersBatch] Exception:', error);
    throw error instanceof Error ? error : new Error('フル履歴マスターの一括保存に失敗しました');
  }
}

/**
 * 全フル履歴マスターをクリア
 */
export async function clearAllFullHistoryMasters(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([FULL_HISTORY_STORE], 'readwrite');
    const objectStore = transaction.objectStore(FULL_HISTORY_STORE);
    const request = objectStore.clear();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('フル履歴マスターのクリアに失敗しました'));
    });
  } catch (error) {
    console.error('clearAllFullHistoryMasters error:', error);
    throw error;
  }
}

// ============================================================================
// 実施マスター操作
// ============================================================================

/**
 * 全実施マスターを取得
 */
export async function getAllImplementationMasters(): Promise<Map<string, ImplementationMaster>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([IMPLEMENTATION_STORE], 'readonly');
    const objectStore = transaction.objectStore(IMPLEMENTATION_STORE);
    const request = objectStore.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const data = new Map<string, ImplementationMaster>();
        (request.result as ImplementationMaster[]).forEach(record => {
          data.set(record.friendId, restoreImplementationMaster(record));
        });
        resolve(data);
      };

      request.onerror = () => {
        reject(new Error('実施マスターの取得に失敗しました'));
      };
    });
  } catch (error) {
    console.error('getAllImplementationMasters error:', error);
    return new Map();
  }
}

/**
 * 実施マスターを一括保存
 */
export async function saveImplementationMastersBatch(masters: Map<string, ImplementationMaster>): Promise<void> {
  if (masters.size === 0) return;

  try {
    const db = await openDatabase();
    const transaction = db.transaction([IMPLEMENTATION_STORE], 'readwrite');
    const objectStore = transaction.objectStore(IMPLEMENTATION_STORE);

    return new Promise((resolve, reject) => {
      let errorOccurred = false;

      masters.forEach((record, key) => {
        try {
          const request = objectStore.put(record);
          request.onerror = () => {
            errorOccurred = true;
            console.error(`[saveImplementationMastersBatch] put error for ${key}:`, request.error);
          };
        } catch (error) {
          errorOccurred = true;
          console.error(`[saveImplementationMastersBatch] Exception for ${key}:`, error);
        }
      });

      transaction.oncomplete = () => {
        if (errorOccurred) {
          reject(new Error('一部の実施マスターの保存に失敗しました'));
        } else {
          resolve();
        }
      };

      transaction.onerror = () => {
        reject(new Error(`実施マスターの一括保存に失敗しました: ${transaction.error?.message}`));
      };

      transaction.onabort = () => {
        reject(new Error(`トランザクションが中断されました: ${transaction.error?.message}`));
      };
    });
  } catch (error) {
    console.error('[saveImplementationMastersBatch] Exception:', error);
    throw error instanceof Error ? error : new Error('実施マスターの一括保存に失敗しました');
  }
}

/**
 * 全実施マスターをクリア
 */
export async function clearAllImplementationMasters(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([IMPLEMENTATION_STORE], 'readwrite');
    const objectStore = transaction.objectStore(IMPLEMENTATION_STORE);
    const request = objectStore.clear();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('実施マスターのクリアに失敗しました'));
    });
  } catch (error) {
    console.error('clearAllImplementationMasters error:', error);
    throw error;
  }
}

// ============================================================================
// 両方のマスターを操作
// ============================================================================

/**
 * 両方のマスターをクリア
 */
export async function clearAllMasters(): Promise<void> {
  await clearAllFullHistoryMasters();
  await clearAllImplementationMasters();
}

/**
 * 両方のマスターを一括保存
 */
export async function saveAllMastersBatch(
  fullHistoryMasters: Map<string, FullHistoryMaster>,
  implementationMasters: Map<string, ImplementationMaster>
): Promise<void> {
  await saveFullHistoryMastersBatch(fullHistoryMasters);
  await saveImplementationMastersBatch(implementationMasters);
}

// ============================================================================
// データベース管理
// ============================================================================

/**
 * データベース全体を削除（開発用）
 */
export async function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('データベースの削除に失敗しました'));
  });
}
