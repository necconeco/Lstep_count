/**
 * Supabase同期機能
 * IndexedDBのマスターデータをSupabaseと同期させる
 */

import { supabase, type UserVisitHistory } from './supabase';
import type { ImplementationMaster } from '../domain/masterTypes';

// ============================================================================
// 同期状態の管理
// ============================================================================

export interface SyncStatus {
  lastSyncedAt: Date | null;
  isSyncing: boolean;
  error: string | null;
  localCount: number;
  cloudCount: number;
}

let syncStatus: SyncStatus = {
  lastSyncedAt: null,
  isSyncing: false,
  error: null,
  localCount: 0,
  cloudCount: 0,
};

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

// ============================================================================
// データ変換
// ============================================================================

/**
 * ImplementationMaster → Supabase形式に変換
 */
function toSupabaseFormat(master: ImplementationMaster): UserVisitHistory {
  return {
    friend_id: master.friendId,
    implementation_count: master.implementationCount,
    last_implementation_date: master.lastImplementationDate?.toISOString() || null,
  };
}

/**
 * Supabase形式 → ImplementationMaster（簡易版）に変換
 * 注意: recordsは復元されないため、フル機能には使えない
 */
function fromSupabaseFormat(data: UserVisitHistory): Partial<ImplementationMaster> {
  return {
    friendId: data.friend_id,
    implementationCount: data.implementation_count,
    lastImplementationDate: data.last_implementation_date
      ? new Date(data.last_implementation_date)
      : null,
  };
}

// ============================================================================
// クラウドへのアップロード
// ============================================================================

/**
 * ローカルのマスターデータをクラウドにアップロード
 */
export async function uploadToCloud(
  implementationMasters: Map<string, ImplementationMaster>
): Promise<void> {
  if (implementationMasters.size === 0) {
    console.log('[uploadToCloud] No data to upload');
    return;
  }

  syncStatus.isSyncing = true;
  syncStatus.error = null;

  try {
    // Map を配列に変換
    const records: UserVisitHistory[] = [];
    implementationMasters.forEach((master) => {
      records.push(toSupabaseFormat(master));
    });

    // 100件ずつバッチ処理
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const { error } = await supabase
        .from('user_visit_history')
        .upsert(batch, { onConflict: 'friend_id' });

      if (error) {
        throw error;
      }
    }

    syncStatus.lastSyncedAt = new Date();
    syncStatus.localCount = implementationMasters.size;

    // クラウドの件数を取得
    const { count } = await supabase
      .from('user_visit_history')
      .select('*', { count: 'exact', head: true });
    syncStatus.cloudCount = count || 0;

    console.log(`[uploadToCloud] Uploaded ${records.length} records`);
  } catch (error) {
    syncStatus.error = error instanceof Error ? error.message : '同期に失敗しました';
    console.error('[uploadToCloud] Error:', error);
    throw error;
  } finally {
    syncStatus.isSyncing = false;
  }
}

// ============================================================================
// クラウドからのダウンロード
// ============================================================================

/**
 * クラウドのマスターデータをダウンロード
 */
export async function downloadFromCloud(): Promise<Map<string, Partial<ImplementationMaster>>> {
  syncStatus.isSyncing = true;
  syncStatus.error = null;

  try {
    const { data, error } = await supabase
      .from('user_visit_history')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    const masters = new Map<string, Partial<ImplementationMaster>>();

    if (data) {
      data.forEach((record: UserVisitHistory) => {
        const master = fromSupabaseFormat(record);
        if (master.friendId) {
          masters.set(master.friendId, master);
        }
      });
    }

    syncStatus.lastSyncedAt = new Date();
    syncStatus.cloudCount = masters.size;

    console.log(`[downloadFromCloud] Downloaded ${masters.size} records`);
    return masters;
  } catch (error) {
    syncStatus.error = error instanceof Error ? error.message : 'ダウンロードに失敗しました';
    console.error('[downloadFromCloud] Error:', error);
    throw error;
  } finally {
    syncStatus.isSyncing = false;
  }
}

// ============================================================================
// 全データ削除
// ============================================================================

/**
 * クラウドの全マスターデータを削除
 */
export async function clearCloud(): Promise<void> {
  syncStatus.isSyncing = true;
  syncStatus.error = null;

  try {
    // friend_id が空でないすべてのレコードを削除
    const { error } = await supabase
      .from('user_visit_history')
      .delete()
      .neq('friend_id', '');

    if (error) {
      throw error;
    }

    syncStatus.cloudCount = 0;
    console.log('[clearCloud] All cloud data cleared');
  } catch (error) {
    syncStatus.error = error instanceof Error ? error.message : '削除に失敗しました';
    console.error('[clearCloud] Error:', error);
    throw error;
  } finally {
    syncStatus.isSyncing = false;
  }
}

// ============================================================================
// 接続テスト
// ============================================================================

/**
 * Supabase接続をテスト
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_visit_history')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[testConnection] Error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[testConnection] Exception:', error);
    return false;
  }
}
