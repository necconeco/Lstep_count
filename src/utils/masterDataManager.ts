/**
 * IndexedDB管理 - 履歴マスタデータ
 */
import type { UserHistoryMaster } from '../types';

const DB_NAME = 'lstep-aggregation-db';
const DB_VERSION = 1;
const STORE_NAME = 'user-history-master';

/**
 * IndexedDBの初期化
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('IndexedDBを開けませんでした'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // オブジェクトストアがなければ作成
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'friendId' });
        objectStore.createIndex('lastImplementationDate', 'lastImplementationDate', {
          unique: false,
        });
        objectStore.createIndex('implementationCount', 'implementationCount', { unique: false });
      }
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
        (request.result as UserHistoryMaster[]).forEach((record) => {
          // Date型に変換
          data.set(record.friendId, {
            ...record,
            lastImplementationDate: record.lastImplementationDate
              ? new Date(record.lastImplementationDate)
              : null,
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
          resolve({
            ...record,
            lastImplementationDate: record.lastImplementationDate
              ? new Date(record.lastImplementationDate)
              : null,
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
export async function saveMasterDataBatch(
  records: Map<string, UserHistoryMaster>
): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    const promises: Promise<void>[] = [];

    records.forEach((record) => {
      promises.push(
        new Promise((resolve, reject) => {
          const request = objectStore.put(record);
          request.onsuccess = () => resolve();
          request.onerror = () => reject();
        })
      );
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('saveMasterDataBatch error:', error);
    throw new Error('履歴マスタデータの一括保存に失敗しました');
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
