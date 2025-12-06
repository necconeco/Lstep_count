/**
 * Infrastructure層 - IndexedDBリポジトリ
 *
 * ストア構成:
 * 1. reservation-history: CSVの生データ蓄積
 * 2. user-visit-count: 初回/2回目判定用カウンター
 * 3. campaign-master: キャンペーン定義
 * 4. audit-log: 手動変更の履歴
 * 5. staff-master: 担当者マスター
 * 6. aggregation-snapshot: 確定集計結果
 * 7. snapshot-folder: スナップショットフォルダ
 */

import type {
  ReservationHistory,
  UserVisitCount,
  CampaignMaster,
  AuditLog,
  StaffMaster,
  AggregationSnapshot,
  SnapshotFolder,
} from '../domain/types';

// ============================================================================
// 定数
// ============================================================================

const DB_NAME = 'lstep-aggregation-v3';
const DB_VERSION = 2;  // v1 → v2 に更新

// ストア名
const STORE_HISTORY = 'reservation-history';
const STORE_USER_COUNT = 'user-visit-count';
const STORE_CAMPAIGN = 'campaign-master';
const STORE_AUDIT_LOG = 'audit-log';
const STORE_STAFF = 'staff-master';
const STORE_SNAPSHOT = 'aggregation-snapshot';
const STORE_FOLDER = 'snapshot-folder';

// ============================================================================
// データベース初期化
// ============================================================================

let dbInstance: IDBDatabase | null = null;

/**
 * IndexedDBを開く
 */
async function openDatabase(): Promise<IDBDatabase> {
  // 既に開いていれば再利用
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDBがサポートされていません'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDBを開けませんでした:', request.error);
      reject(new Error(`IndexedDBを開けませんでした: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      // ① reservation-history ストア
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        const historyStore = db.createObjectStore(STORE_HISTORY, {
          keyPath: 'reservationId',
        });
        historyStore.createIndex('friendId', 'friendId', { unique: false });
        historyStore.createIndex('sessionDate', 'sessionDate', { unique: false });
        historyStore.createIndex('applicationDate', 'applicationDate', { unique: false });
        historyStore.createIndex('isImplemented', 'isImplemented', { unique: false });
        historyStore.createIndex('wasOmakase', 'wasOmakase', { unique: false });
        historyStore.createIndex('groupId', 'groupId', { unique: false });
      } else if (oldVersion < 2) {
        // v1 → v2 マイグレーション: 既存ストアにインデックス追加
        const tx = (event.target as IDBOpenDBRequest).transaction!;
        const historyStore = tx.objectStore(STORE_HISTORY);
        if (!historyStore.indexNames.contains('wasOmakase')) {
          historyStore.createIndex('wasOmakase', 'wasOmakase', { unique: false });
        }
        if (!historyStore.indexNames.contains('groupId')) {
          historyStore.createIndex('groupId', 'groupId', { unique: false });
        }
      }

      // ② user-visit-count ストア
      if (!db.objectStoreNames.contains(STORE_USER_COUNT)) {
        const userStore = db.createObjectStore(STORE_USER_COUNT, {
          keyPath: 'friendId',
        });
        userStore.createIndex('implementationCount', 'implementationCount', { unique: false });
      }

      // ③ campaign-master ストア
      if (!db.objectStoreNames.contains(STORE_CAMPAIGN)) {
        const campaignStore = db.createObjectStore(STORE_CAMPAIGN, {
          keyPath: 'campaignId',
        });
        campaignStore.createIndex('isActive', 'isActive', { unique: false });
      }

      // ④ audit-log ストア（v2で追加）
      if (!db.objectStoreNames.contains(STORE_AUDIT_LOG)) {
        const auditStore = db.createObjectStore(STORE_AUDIT_LOG, {
          keyPath: 'id',
        });
        auditStore.createIndex('reservationId', 'reservationId', { unique: false });
        auditStore.createIndex('changedAt', 'changedAt', { unique: false });
        auditStore.createIndex('field', 'field', { unique: false });
      }

      // ⑤ staff-master ストア（v2で追加）
      if (!db.objectStoreNames.contains(STORE_STAFF)) {
        const staffStore = db.createObjectStore(STORE_STAFF, {
          keyPath: 'staffId',
        });
        staffStore.createIndex('staffName', 'staffName', { unique: false });
        staffStore.createIndex('isActive', 'isActive', { unique: false });
        staffStore.createIndex('sortOrder', 'sortOrder', { unique: false });
      }

      // ⑥ aggregation-snapshot ストア（v2で追加）
      if (!db.objectStoreNames.contains(STORE_SNAPSHOT)) {
        const snapshotStore = db.createObjectStore(STORE_SNAPSHOT, {
          keyPath: 'id',
        });
        snapshotStore.createIndex('type', 'type', { unique: false });
        snapshotStore.createIndex('folderName', 'folderName', { unique: false });
        snapshotStore.createIndex('isPinned', 'isPinned', { unique: false });
        snapshotStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // ⑦ snapshot-folder ストア（v2で追加）
      if (!db.objectStoreNames.contains(STORE_FOLDER)) {
        const folderStore = db.createObjectStore(STORE_FOLDER, {
          keyPath: 'folderId',
        });
        folderStore.createIndex('folderName', 'folderName', { unique: true });
        folderStore.createIndex('sortOrder', 'sortOrder', { unique: false });
      }

    };

    request.onblocked = () => {
      console.warn('IndexedDB: 他のタブでDBが開かれているため、アップグレードがブロックされました');
    };
  });
}

// ============================================================================
// Date復元ヘルパー
// ============================================================================

function restoreHistoryDates(record: ReservationHistory): ReservationHistory {
  return {
    ...record,
    sessionDate: new Date(record.sessionDate),
    applicationDate: new Date(record.applicationDate),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function restoreUserCountDates(record: UserVisitCount): UserVisitCount {
  return {
    ...record,
    lastSessionDate: record.lastSessionDate ? new Date(record.lastSessionDate) : null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function restoreCampaignDates(record: CampaignMaster): CampaignMaster {
  return {
    ...record,
    targetPeriodFrom: new Date(record.targetPeriodFrom),
    targetPeriodTo: new Date(record.targetPeriodTo),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

// ============================================================================
// ① reservation-history 操作
// ============================================================================

/**
 * 全履歴を取得
 */
export async function getAllHistories(): Promise<Map<string, ReservationHistory>> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_HISTORY], 'readonly');
  const store = tx.objectStore(STORE_HISTORY);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const map = new Map<string, ReservationHistory>();
      (request.result as ReservationHistory[]).forEach((record) => {
        map.set(record.reservationId, restoreHistoryDates(record));
      });
      resolve(map);
    };
    request.onerror = () => reject(new Error('履歴の取得に失敗しました'));
  });
}

/**
 * 履歴を一括保存（upsert）
 */
export async function saveHistoriesBatch(
  histories: Map<string, ReservationHistory>
): Promise<void> {
  if (histories.size === 0) return;

  const db = await openDatabase();
  const tx = db.transaction([STORE_HISTORY], 'readwrite');
  const store = tx.objectStore(STORE_HISTORY);

  return new Promise((resolve, reject) => {
    histories.forEach((record) => {
      store.put(record);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('履歴の保存に失敗しました'));
  });
}

/**
 * 全履歴をクリア
 */
export async function clearAllHistories(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_HISTORY], 'readwrite');
  const store = tx.objectStore(STORE_HISTORY);
  const request = store.clear();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('履歴のクリアに失敗しました'));
  });
}

// ============================================================================
// ② user-visit-count 操作
// ============================================================================

/**
 * 全ユーザーカウントを取得
 */
export async function getAllUserCounts(): Promise<Map<string, UserVisitCount>> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_USER_COUNT], 'readonly');
  const store = tx.objectStore(STORE_USER_COUNT);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const map = new Map<string, UserVisitCount>();
      (request.result as UserVisitCount[]).forEach((record) => {
        map.set(record.friendId, restoreUserCountDates(record));
      });
      resolve(map);
    };
    request.onerror = () => reject(new Error('ユーザーカウントの取得に失敗しました'));
  });
}

/**
 * ユーザーカウントを一括保存（upsert）
 */
export async function saveUserCountsBatch(
  userCounts: Map<string, UserVisitCount>
): Promise<void> {
  if (userCounts.size === 0) return;

  const db = await openDatabase();
  const tx = db.transaction([STORE_USER_COUNT], 'readwrite');
  const store = tx.objectStore(STORE_USER_COUNT);

  return new Promise((resolve, reject) => {
    userCounts.forEach((record) => {
      store.put(record);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('ユーザーカウントの保存に失敗しました'));
  });
}

/**
 * 全ユーザーカウントをクリア
 */
export async function clearAllUserCounts(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_USER_COUNT], 'readwrite');
  const store = tx.objectStore(STORE_USER_COUNT);
  const request = store.clear();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('ユーザーカウントのクリアに失敗しました'));
  });
}

// ============================================================================
// ③ campaign-master 操作
// ============================================================================

/**
 * 全キャンペーンを取得
 */
export async function getAllCampaigns(): Promise<CampaignMaster[]> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_CAMPAIGN], 'readonly');
  const store = tx.objectStore(STORE_CAMPAIGN);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const campaigns = (request.result as CampaignMaster[]).map(restoreCampaignDates);
      resolve(campaigns);
    };
    request.onerror = () => reject(new Error('キャンペーンの取得に失敗しました'));
  });
}

/**
 * キャンペーンを保存（upsert）
 */
export async function saveCampaign(campaign: CampaignMaster): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_CAMPAIGN], 'readwrite');
  const store = tx.objectStore(STORE_CAMPAIGN);

  return new Promise((resolve, reject) => {
    const request = store.put(campaign);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('キャンペーンの保存に失敗しました'));
  });
}

/**
 * キャンペーンを削除
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_CAMPAIGN], 'readwrite');
  const store = tx.objectStore(STORE_CAMPAIGN);

  return new Promise((resolve, reject) => {
    const request = store.delete(campaignId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('キャンペーンの削除に失敗しました'));
  });
}

/**
 * 初期キャンペーンを登録（存在しなければ）
 */
export async function initializeDefaultCampaigns(): Promise<void> {
  const existing = await getAllCampaigns();
  if (existing.length > 0) return;

  const now = new Date();

  // デフォルトキャンペーン
  const defaultCampaigns: CampaignMaster[] = [
    {
      campaignId: 'career-202411',
      campaignName: 'キャリア相談11月',
      description: '2024年11月のキャリア相談キャンペーン',
      targetPeriodFrom: new Date('2024-11-01'),
      targetPeriodTo: new Date('2024-11-30'),
      targetDateType: 'application',
      fiscalYear: 2024,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      campaignId: 'career-202412',
      campaignName: 'キャリア相談12月',
      description: '2024年12月のキャリア相談キャンペーン',
      targetPeriodFrom: new Date('2024-12-01'),
      targetPeriodTo: new Date('2024-12-31'),
      targetDateType: 'application',
      fiscalYear: 2024,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      campaignId: 'career-202501',
      campaignName: 'キャリア相談1月',
      description: '2025年1月のキャリア相談キャンペーン',
      targetPeriodFrom: new Date('2025-01-01'),
      targetPeriodTo: new Date('2025-01-31'),
      targetDateType: 'application',
      fiscalYear: 2024,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const campaign of defaultCampaigns) {
    await saveCampaign(campaign);
  }
}

// ============================================================================
// 全データクリア
// ============================================================================

/**
 * 全ストアをクリア
 */
export async function clearAllData(): Promise<void> {
  await clearAllHistories();
  await clearAllUserCounts();
}

/**
 * データベース全体を削除（開発用）
 */
export async function deleteDatabase(): Promise<void> {
  dbInstance = null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('データベースの削除に失敗しました'));
  });
}

// ============================================================================
// ④ audit-log 操作
// ============================================================================

/**
 * Date復元ヘルパー（AuditLog用）
 */
function restoreAuditLogDates(record: AuditLog): AuditLog {
  return {
    ...record,
    changedAt: new Date(record.changedAt),
  };
}

/**
 * 監査ログを保存
 */
export async function saveAuditLog(log: AuditLog): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_AUDIT_LOG], 'readwrite');
  const store = tx.objectStore(STORE_AUDIT_LOG);

  return new Promise((resolve, reject) => {
    const request = store.put(log);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('監査ログの保存に失敗しました'));
  });
}

/**
 * 予約IDに紐づく監査ログを取得
 */
export async function getAuditLogsByReservationId(reservationId: string): Promise<AuditLog[]> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_AUDIT_LOG], 'readonly');
  const store = tx.objectStore(STORE_AUDIT_LOG);
  const index = store.index('reservationId');
  const request = index.getAll(reservationId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const logs = (request.result as AuditLog[]).map(restoreAuditLogDates);
      resolve(logs.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime()));
    };
    request.onerror = () => reject(new Error('監査ログの取得に失敗しました'));
  });
}

/**
 * 全監査ログを取得（新しい順）
 */
export async function getAllAuditLogs(): Promise<AuditLog[]> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_AUDIT_LOG], 'readonly');
  const store = tx.objectStore(STORE_AUDIT_LOG);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const logs = (request.result as AuditLog[]).map(restoreAuditLogDates);
      resolve(logs.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime()));
    };
    request.onerror = () => reject(new Error('監査ログの取得に失敗しました'));
  });
}

// ============================================================================
// ⑤ staff-master 操作
// ============================================================================

/**
 * Date復元ヘルパー（StaffMaster用）
 */
function restoreStaffDates(record: StaffMaster): StaffMaster {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

/**
 * 全担当者を取得（sortOrder順）
 */
export async function getAllStaff(): Promise<StaffMaster[]> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_STAFF], 'readonly');
  const store = tx.objectStore(STORE_STAFF);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const staff = (request.result as StaffMaster[]).map(restoreStaffDates);
      resolve(staff.sort((a, b) => a.sortOrder - b.sortOrder));
    };
    request.onerror = () => reject(new Error('担当者の取得に失敗しました'));
  });
}

/**
 * 有効な担当者のみ取得
 */
export async function getActiveStaff(): Promise<StaffMaster[]> {
  const allStaff = await getAllStaff();
  return allStaff.filter((s) => s.isActive);
}

/**
 * 担当者を保存（upsert）
 */
export async function saveStaff(staff: StaffMaster): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_STAFF], 'readwrite');
  const store = tx.objectStore(STORE_STAFF);

  return new Promise((resolve, reject) => {
    const request = store.put(staff);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('担当者の保存に失敗しました'));
  });
}

/**
 * 担当者を削除
 */
export async function deleteStaff(staffId: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_STAFF], 'readwrite');
  const store = tx.objectStore(STORE_STAFF);

  return new Promise((resolve, reject) => {
    const request = store.delete(staffId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('担当者の削除に失敗しました'));
  });
}

/**
 * 担当者名（またはエイリアス）から担当者を検索
 */
export async function findStaffByNameOrAlias(name: string): Promise<StaffMaster | undefined> {
  const allStaff = await getAllStaff();
  return allStaff.find(
    (s) => s.staffName === name || s.aliases.includes(name)
  );
}

// ============================================================================
// ⑥ aggregation-snapshot 操作
// ============================================================================

/**
 * Date復元ヘルパー（AggregationSnapshot用）
 */
function restoreSnapshotDates(record: AggregationSnapshot): AggregationSnapshot {
  return {
    ...record,
    periodFrom: new Date(record.periodFrom),
    periodTo: new Date(record.periodTo),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

/**
 * 全スナップショットを取得（作成日降順）
 */
export async function getAllSnapshots(): Promise<AggregationSnapshot[]> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_SNAPSHOT], 'readonly');
  const store = tx.objectStore(STORE_SNAPSHOT);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const snapshots = (request.result as AggregationSnapshot[]).map(restoreSnapshotDates);
      // ピン留め優先、次に作成日降順
      resolve(snapshots.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      }));
    };
    request.onerror = () => reject(new Error('スナップショットの取得に失敗しました'));
  });
}

/**
 * スナップショットを保存
 */
export async function saveSnapshot(snapshot: AggregationSnapshot): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_SNAPSHOT], 'readwrite');
  const store = tx.objectStore(STORE_SNAPSHOT);

  return new Promise((resolve, reject) => {
    const request = store.put(snapshot);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('スナップショットの保存に失敗しました'));
  });
}

/**
 * スナップショットを更新（部分更新）
 */
export async function updateSnapshot(
  id: string,
  updates: Partial<Omit<AggregationSnapshot, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_SNAPSHOT], 'readwrite');
  const store = tx.objectStore(STORE_SNAPSHOT);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result as AggregationSnapshot | undefined;
      if (!existing) {
        reject(new Error('スナップショットが見つかりません'));
        return;
      }

      const updated: AggregationSnapshot = {
        ...restoreSnapshotDates(existing),
        ...updates,
        updatedAt: new Date(),
      };

      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error('スナップショットの更新に失敗しました'));
    };
    getRequest.onerror = () => reject(new Error('スナップショットの取得に失敗しました'));
  });
}

/**
 * スナップショットを削除
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_SNAPSHOT], 'readwrite');
  const store = tx.objectStore(STORE_SNAPSHOT);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('スナップショットの削除に失敗しました'));
  });
}

/**
 * スナップショットをIDで取得
 */
export async function getSnapshotById(id: string): Promise<AggregationSnapshot | undefined> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_SNAPSHOT], 'readonly');
  const store = tx.objectStore(STORE_SNAPSHOT);

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const result = request.result as AggregationSnapshot | undefined;
      resolve(result ? restoreSnapshotDates(result) : undefined);
    };
    request.onerror = () => reject(new Error('スナップショットの取得に失敗しました'));
  });
}

// ============================================================================
// ⑦ snapshot-folder 操作
// ============================================================================

/**
 * Date復元ヘルパー（SnapshotFolder用）
 */
function restoreFolderDates(record: SnapshotFolder): SnapshotFolder {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
  };
}

/**
 * 全フォルダを取得（sortOrder順）
 */
export async function getAllFolders(): Promise<SnapshotFolder[]> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_FOLDER], 'readonly');
  const store = tx.objectStore(STORE_FOLDER);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const folders = (request.result as SnapshotFolder[]).map(restoreFolderDates);
      resolve(folders.sort((a, b) => a.sortOrder - b.sortOrder));
    };
    request.onerror = () => reject(new Error('フォルダの取得に失敗しました'));
  });
}

/**
 * フォルダを保存
 */
export async function saveFolder(folder: SnapshotFolder): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_FOLDER], 'readwrite');
  const store = tx.objectStore(STORE_FOLDER);

  return new Promise((resolve, reject) => {
    const request = store.put(folder);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('フォルダの保存に失敗しました'));
  });
}

/**
 * フォルダを削除
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_FOLDER], 'readwrite');
  const store = tx.objectStore(STORE_FOLDER);

  return new Promise((resolve, reject) => {
    const request = store.delete(folderId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('フォルダの削除に失敗しました'));
  });
}

/**
 * フォルダ名でフォルダを検索
 */
export async function getFolderByName(folderName: string): Promise<SnapshotFolder | undefined> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_FOLDER], 'readonly');
  const store = tx.objectStore(STORE_FOLDER);
  const index = store.index('folderName');

  return new Promise((resolve, reject) => {
    const request = index.get(folderName);
    request.onsuccess = () => {
      const result = request.result as SnapshotFolder | undefined;
      resolve(result ? restoreFolderDates(result) : undefined);
    };
    request.onerror = () => reject(new Error('フォルダの検索に失敗しました'));
  });
}

// ============================================================================
// 履歴の単一レコード操作（手動編集用）
// ============================================================================

/**
 * 履歴を1件取得
 */
export async function getHistoryById(reservationId: string): Promise<ReservationHistory | undefined> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_HISTORY], 'readonly');
  const store = tx.objectStore(STORE_HISTORY);

  return new Promise((resolve, reject) => {
    const request = store.get(reservationId);
    request.onsuccess = () => {
      const result = request.result as ReservationHistory | undefined;
      resolve(result ? restoreHistoryDates(result) : undefined);
    };
    request.onerror = () => reject(new Error('履歴の取得に失敗しました'));
  });
}

/**
 * 履歴を1件保存
 */
export async function saveHistory(history: ReservationHistory): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_HISTORY], 'readwrite');
  const store = tx.objectStore(STORE_HISTORY);

  return new Promise((resolve, reject) => {
    const request = store.put(history);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('履歴の保存に失敗しました'));
  });
}
