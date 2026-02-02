/**
 * Store層 - マスターデータ管理ストア（V2: 2系統マスター対応）
 * ユースケース: CSVマージ、visitIndex再計算、永続化
 */
import { create } from 'zustand';

import type { CsvRecord } from '../types';
import type {
  FullHistoryMaster,
  ImplementationMaster,
  FlattenedRecord,
  MasterDataSummary,
} from '../domain';
import {
  batchMergeFullHistoryMasters,
  deriveImplementationMasters,
  flattenFullHistoryMasters,
  getMasterDataSummary,
  flattenedRecordsToCSV,
  getVisitLabel,
} from '../domain';
import * as masterRepository from '../infrastructure';
import { uploadToCloud, downloadFromCloud } from '../lib/supabaseSync';
import { toMasterCsvInputRecord } from '../adapters';

// ============================================================================
// ストア型定義
// ============================================================================

export interface MasterStoreV2State {
  // マスターデータ
  fullHistoryMasters: Map<string, FullHistoryMaster>;
  implementationMasters: Map<string, ImplementationMaster>;

  // ローディング状態
  isLoading: boolean;
  error: string | null;

  // アクション
  loadMasters: () => Promise<void>;
  clearMasters: () => Promise<void>;
  mergeCsvData: (csvRecords: CsvRecord[]) => Promise<void>;

  // ゲッター
  getFlattenedRecords: () => FlattenedRecord[];
  getSummary: () => MasterDataSummary;
  getImplementationCount: (friendId: string) => number;
  getVisitType: (friendId: string) => '初回' | '2回目' | '3回目以降';
  exportToCSV: () => string;
}

// ============================================================================
// ストア作成
// ============================================================================

export const useMasterStoreV2 = create<MasterStoreV2State>((set, get) => ({
  fullHistoryMasters: new Map<string, FullHistoryMaster>(),
  implementationMasters: new Map<string, ImplementationMaster>(),
  isLoading: false,
  error: null,

  /**
   * マスターデータをIndexedDBから読み込み
   * ローカルが空の場合、クラウドから復元を試みる
   */
  loadMasters: async () => {
    set({ isLoading: true, error: null });
    try {
      const [fullHistoryMasters, implementationMasters] = await Promise.all([
        masterRepository.getAllFullHistoryMasters(),
        masterRepository.getAllImplementationMasters(),
      ]);

      // ローカルが空の場合、クラウドから復元を試みる
      if (implementationMasters.size === 0) {
        try {
          const cloudData = await downloadFromCloud();
          if (cloudData.size > 0) {
            // クラウドからの復元データをImplementationMasterとして使用
            const restoredMasters = new Map<string, ImplementationMaster>();
            const now = new Date();
            cloudData.forEach((partial, friendId) => {
              restoredMasters.set(friendId, {
                friendId: partial.friendId || friendId,
                implementationCount: partial.implementationCount || 0,
                lastImplementationDate: partial.lastImplementationDate || null,
                lastStaff: null,
                records: [], // 履歴詳細は復元できない
                createdAt: now,
                updatedAt: now,
              });
            });
            // IndexedDBにも保存
            await masterRepository.saveImplementationMastersBatch(restoredMasters);
            set({
              fullHistoryMasters,
              implementationMasters: restoredMasters,
              isLoading: false,
            });
            return;
          }
        } catch (cloudError) {
          console.warn('[loadMasters] Cloud restore failed (non-blocking):', cloudError);
        }
      }

      set({
        fullHistoryMasters,
        implementationMasters,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'マスターデータの読み込みに失敗しました',
        isLoading: false,
      });
    }
  },

  /**
   * マスターデータをクリア
   */
  clearMasters: async () => {
    try {
      await masterRepository.clearAllMasters();
      set({
        fullHistoryMasters: new Map(),
        implementationMasters: new Map(),
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'マスターデータのクリアに失敗しました',
      });
    }
  },

  /**
   * CSVデータをマスターにマージ（メインユースケース）
   * 1. CsvRecord → CsvInputRecord に変換
   * 2. フル履歴マスターにマージ（後勝ち、重複排除）
   * 3. 実施マスターを導出
   * 4. IndexedDBに保存
   */
  mergeCsvData: async (csvRecords: CsvRecord[]) => {
    const { fullHistoryMasters, implementationMasters } = get();
    set({ isLoading: true, error: null });

    try {
      // 1. CsvRecord → MasterCsvInputRecord に変換（Adapter経由）
      const inputRecords = csvRecords.map(toMasterCsvInputRecord);

      // 2. Domain層: フル履歴マスターにマージ
      const updatedFullHistory = batchMergeFullHistoryMasters(fullHistoryMasters, inputRecords);

      // 3. Domain層: 実施マスターを導出
      const updatedImplementation = deriveImplementationMasters(updatedFullHistory, implementationMasters);

      // 4. Infrastructure層: IndexedDBに保存
      await masterRepository.saveAllMastersBatch(updatedFullHistory, updatedImplementation);

      // 5. ストアを更新
      set({
        fullHistoryMasters: updatedFullHistory,
        implementationMasters: updatedImplementation,
        isLoading: false,
      });

      // 6. クラウドに自動同期（バックグラウンド、エラーは無視）
      uploadToCloud(updatedImplementation).catch((err) => {
        console.warn('[mergeCsvData] Cloud sync failed (non-blocking):', err);
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'CSVデータのマージに失敗しました',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * フラット化されたレコードを取得
   */
  getFlattenedRecords: () => {
    const { fullHistoryMasters } = get();
    return flattenFullHistoryMasters(fullHistoryMasters);
  },

  /**
   * 統計サマリーを取得
   */
  getSummary: () => {
    const { fullHistoryMasters } = get();
    return getMasterDataSummary(fullHistoryMasters);
  },

  /**
   * 特定ユーザーの実施回数を取得
   */
  getImplementationCount: (friendId: string) => {
    const { implementationMasters } = get();
    const master = implementationMasters.get(friendId);
    return master?.implementationCount || 0;
  },

  /**
   * 特定ユーザーの次回来店タイプを取得
   * （現在の実施回数 + 1 回目として計算）
   */
  getVisitType: (friendId: string) => {
    const { implementationMasters } = get();
    const master = implementationMasters.get(friendId);
    const count = master?.implementationCount || 0;
    return getVisitLabel(count + 1);
  },

  /**
   * CSV形式でエクスポート
   */
  exportToCSV: () => {
    const { fullHistoryMasters } = get();
    const flattened = flattenFullHistoryMasters(fullHistoryMasters);
    return flattenedRecordsToCSV(flattened);
  },
}));
