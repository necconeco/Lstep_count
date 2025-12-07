/**
 * 自動バックアップユーティリティ
 *
 * 定期的にIndexedDBのデータをlocalStorageにバックアップし、
 * データ損失時に復旧できるようにします。
 */

import { getLogger } from './logger';

const logger = getLogger('AutoBackup');

// バックアップ設定
const BACKUP_KEY = 'lstep_auto_backup';
const BACKUP_TIMESTAMP_KEY = 'lstep_auto_backup_timestamp';
const BACKUP_INTERVAL_MS = 5 * 60 * 1000; // 5分ごと
const MAX_BACKUP_SIZE_MB = 5; // localStorage制限を考慮して5MB

// タイマーID
let backupTimerId: ReturnType<typeof setInterval> | null = null;

/**
 * バックアップデータの型
 */
export interface BackupData {
  version: string;
  timestamp: string;
  dataSize: number;
  compressed: boolean;
  data: string; // JSON文字列
}

/**
 * 自動バックアップを開始
 */
export function startAutoBackup(getDataFn: () => string): void {
  if (backupTimerId) {
    return; // 既に開始済み
  }

  // 初回バックアップ
  performBackup(getDataFn);

  // 定期バックアップを開始
  backupTimerId = setInterval(() => {
    performBackup(getDataFn);
  }, BACKUP_INTERVAL_MS);

  logger.info('自動バックアップを開始しました', { intervalMs: BACKUP_INTERVAL_MS });
}

/**
 * 自動バックアップを停止
 */
export function stopAutoBackup(): void {
  if (backupTimerId) {
    clearInterval(backupTimerId);
    backupTimerId = null;
    logger.info('自動バックアップを停止しました');
  }
}

/**
 * バックアップを実行
 */
export function performBackup(getDataFn: () => string): boolean {
  try {
    const jsonData = getDataFn();
    const dataSize = new Blob([jsonData]).size;
    const dataSizeMB = dataSize / (1024 * 1024);

    // サイズチェック
    if (dataSizeMB > MAX_BACKUP_SIZE_MB) {
      logger.warn('データサイズが大きすぎるため、自動バックアップをスキップ', {
        sizeMB: dataSizeMB.toFixed(2),
        maxMB: MAX_BACKUP_SIZE_MB,
      });
      return false;
    }

    const backup: BackupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      dataSize,
      compressed: false,
      data: jsonData,
    };

    // localStorageに保存
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    localStorage.setItem(BACKUP_TIMESTAMP_KEY, backup.timestamp);

    logger.debug('自動バックアップ完了', {
      sizeMB: dataSizeMB.toFixed(2),
      timestamp: backup.timestamp,
    });

    return true;
  } catch (error) {
    logger.error('自動バックアップに失敗', error);
    return false;
  }
}

/**
 * バックアップからデータを復元
 */
export function restoreFromBackup(): { success: boolean; data?: string; timestamp?: string; error?: string } {
  try {
    const backupStr = localStorage.getItem(BACKUP_KEY);
    if (!backupStr) {
      return { success: false, error: 'バックアップが見つかりません' };
    }

    const backup: BackupData = JSON.parse(backupStr);

    // バージョンチェック
    if (!backup.version || !backup.data) {
      return { success: false, error: 'バックアップデータが不正です' };
    }

    return {
      success: true,
      data: backup.data,
      timestamp: backup.timestamp,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '復元に失敗しました';
    logger.error('バックアップ復元に失敗', error);
    return { success: false, error: message };
  }
}

/**
 * 最後のバックアップ日時を取得
 */
export function getLastBackupTimestamp(): string | null {
  return localStorage.getItem(BACKUP_TIMESTAMP_KEY);
}

/**
 * バックアップが存在するかチェック
 */
export function hasBackup(): boolean {
  return localStorage.getItem(BACKUP_KEY) !== null;
}

/**
 * バックアップを削除
 */
export function clearBackup(): void {
  localStorage.removeItem(BACKUP_KEY);
  localStorage.removeItem(BACKUP_TIMESTAMP_KEY);
  logger.info('バックアップを削除しました');
}

/**
 * バックアップのサイズを取得（バイト）
 */
export function getBackupSize(): number {
  const backupStr = localStorage.getItem(BACKUP_KEY);
  if (!backupStr) {
    return 0;
  }
  return new Blob([backupStr]).size;
}

/**
 * バックアップの概要を取得
 */
export function getBackupSummary(): {
  exists: boolean;
  timestamp: string | null;
  sizeBytes: number;
  sizeMB: string;
} {
  const exists = hasBackup();
  const timestamp = getLastBackupTimestamp();
  const sizeBytes = getBackupSize();

  return {
    exists,
    timestamp,
    sizeBytes,
    sizeMB: (sizeBytes / (1024 * 1024)).toFixed(2),
  };
}
