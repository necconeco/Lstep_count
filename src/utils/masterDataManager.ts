/**
 * IndexedDB管理 - 履歴マスタデータ
 */
import type { UserHistoryMaster } from '../types';

const DB_NAME = 'lstep-aggregation-db';
const DB_VERSION = 3; // バージョン3に統一（V2マスターと共存）
const STORE_NAME = 'user-history-master';

/**
 * IndexedDBの初期化
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // IndexedDBがサポートされているか確認
    if (!window.indexedDB) {
      console.error('[openDatabase] IndexedDBがサポートされていません');
      reject(new Error('お使いのブラウザはIndexedDBをサポートしていません'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = event => {
      console.error('[openDatabase] IndexedDB open error:', request.error);
      console.error('[openDatabase] Error event:', event);
      console.error('[openDatabase] Error name:', request.error?.name);
      console.error('[openDatabase] Error message:', request.error?.message);
      reject(
        new Error(
          `IndexedDBを開けませんでした: ${request.error?.message || '不明なエラー'}（${request.error?.name || 'Unknown'}）`
        )
      );
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 旧ストア（user-history-master）がなければ作成
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'friendId' });
        objectStore.createIndex('lastImplementationDate', 'lastImplementationDate', {
          unique: false,
        });
        objectStore.createIndex('implementationCount', 'implementationCount', { unique: false });
      }

      // V2用ストア（full-history-master）がなければ作成
      if (!db.objectStoreNames.contains('full-history-master')) {
        const fullStore = db.createObjectStore('full-history-master', { keyPath: 'friendId' });
        fullStore.createIndex('lastImplementationDate', 'lastImplementationDate', { unique: false });
        fullStore.createIndex('totalRecordCount', 'totalRecordCount', { unique: false });
      }

      // V2用ストア（implementation-master）がなければ作成
      if (!db.objectStoreNames.contains('implementation-master')) {
        const implStore = db.createObjectStore('implementation-master', { keyPath: 'friendId' });
        implStore.createIndex('lastImplementationDate', 'lastImplementationDate', { unique: false });
        implStore.createIndex('implementationCount', 'implementationCount', { unique: false });
      }
    };

    request.onblocked = () => {
      console.warn('[openDatabase] IndexedDB open blocked - 他のタブでデータベースが開かれている可能性があります');
    };
  });
}

/**
 * 全履歴マスタデータを取得
 */
export async function getAllMasterData(): Promise<Map<string, UserHistoryMaster>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const data = new Map<string, UserHistoryMaster>();
        (request.result as UserHistoryMaster[]).forEach(record => {
          // Date型に変換（implementationHistory と allHistory 内のdateも変換）
          // 旧データ互換性: allHistory が存在しない場合は空配列
          const allHistory = record.allHistory
            ? record.allHistory.map(h => ({
                ...h,
                date: new Date(h.date),
              }))
            : [];

          data.set(record.friendId, {
            ...record,
            allHistory,
            implementationHistory: record.implementationHistory.map(h => ({
              ...h,
              date: new Date(h.date),
            })),
            lastImplementationDate: record.lastImplementationDate ? new Date(record.lastImplementationDate) : null,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          });
        });
        resolve(data);
      };

      request.onerror = () => {
        reject(new Error('履歴マスタデータの取得に失敗しました'));
      };
    });
  } catch (error) {
    console.error('getAllMasterData error:', error);
    return new Map();
  }
}

/**
 * 特定の友だちIDの履歴マスタデータを取得
 */
export async function getMasterRecord(friendId: string): Promise<UserHistoryMaster | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(friendId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        if (request.result) {
          const record = request.result as UserHistoryMaster;
          // 旧データ互換性: allHistory が存在しない場合は空配列
          const allHistory = record.allHistory
            ? record.allHistory.map(h => ({
                ...h,
                date: new Date(h.date),
              }))
            : [];

          resolve({
            ...record,
            allHistory,
            implementationHistory: record.implementationHistory.map(h => ({
              ...h,
              date: new Date(h.date),
            })),
            lastImplementationDate: record.lastImplementationDate ? new Date(record.lastImplementationDate) : null,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error('履歴マスタデータの取得に失敗しました'));
      };
    });
  } catch (error) {
    console.error('getMasterRecord error:', error);
    return null;
  }
}

/**
 * 履歴マスタデータを保存/更新
 */
export async function saveMasterRecord(record: UserHistoryMaster): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.put(record);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('履歴マスタデータの保存に失敗しました'));
      };
    });
  } catch (error) {
    console.error('saveMasterRecord error:', error);
    throw error;
  }
}

/**
 * 複数の履歴マスタデータを一括保存
 */
export async function saveMasterDataBatch(records: Map<string, UserHistoryMaster>): Promise<void> {
  if (records.size === 0) {
    return;
  }

  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    // トランザクションが完了するまで待機
    return new Promise((resolve, reject) => {
      let errorOccurred = false;

      // 各レコードをput
      records.forEach((record, key) => {
        try {
          const request = objectStore.put(record);

          request.onerror = () => {
            errorOccurred = true;
            console.error(`[saveMasterDataBatch] put error for ${key}:`, request.error);
          };
        } catch (error) {
          errorOccurred = true;
          console.error(`[saveMasterDataBatch] Exception during put for ${key}:`, error);
        }
      });

      transaction.oncomplete = () => {
        if (errorOccurred) {
          console.error('[saveMasterDataBatch] トランザクション完了したが、エラーが発生していました');
          reject(new Error('一部のレコードの保存に失敗しました'));
        } else {
          resolve();
        }
      };

      transaction.onerror = () => {
        console.error('[saveMasterDataBatch] Transaction error:', transaction.error);
        reject(new Error(`履歴マスタデータの一括保存に失敗しました: ${transaction.error?.message || '不明なエラー'}`));
      };

      transaction.onabort = () => {
        console.error('[saveMasterDataBatch] Transaction aborted:', transaction.error);
        reject(new Error(`トランザクションが中断されました: ${transaction.error?.message || '不明なエラー'}`));
      };
    });
  } catch (error) {
    console.error('[saveMasterDataBatch] Exception:', error);
    throw error instanceof Error ? error : new Error('履歴マスタデータの一括保存に失敗しました');
  }
}

/**
 * 特定の友だちIDの履歴マスタデータを削除
 */
export async function deleteMasterRecord(friendId: string): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(friendId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('履歴マスタデータの削除に失敗しました'));
      };
    });
  } catch (error) {
    console.error('deleteMasterRecord error:', error);
    throw error;
  }
}

/**
 * 全履歴マスタデータをクリア
 */
export async function clearAllMasterData(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.clear();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('履歴マスタデータのクリアに失敗しました'));
      };
    });
  } catch (error) {
    console.error('clearAllMasterData error:', error);
    throw error;
  }
}

/**
 * データベース全体を削除（開発用）
 */
export async function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('データベースの削除に失敗しました'));
    };
  });
}
