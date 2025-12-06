/**
 * Store層 - マスターデータ管理ストア（V2: 2系統マスター対応）
 * ユースケース: CSVマージ、visitIndex再計算、永続化
 */
import { create } from 'zustand';

import type { CsvRecord } from '../types';
import type {
  FullHistoryMaster,
  ImplementationMaster,
  CsvInputRecord,
  FlattenedRecord,
  MasterDataSummary,
} from '../domain/masterTypes';
import {
  batchMergeFullHistoryMasters,
  deriveImplementationMasters,
  flattenFullHistoryMasters,
  getMasterDataSummary,
  flattenedRecordsToCSV,
  getVisitLabel,
} from '../domain/masterMerge';
import * as masterRepository from '../infrastructure/masterRepository';

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
// CSVレコード変換
// ============================================================================

/**
 * CsvRecord を CsvInputRecord に変換
 */
function csvRecordToInput(record: CsvRecord): CsvInputRecord {
  return {
    reservationId: record.予約ID || '',
    friendId: record.友だちID,
    date: parseDate(record.予約日),
    status: record.ステータス,
    visitStatus: record['来店/来場'],
    name: record.名前,
    staff: record.担当者 || null,
    detailStatus: record.詳細ステータス || null,
    applicationDate: record.申込日時,
  };
}

/**
 * 日付文字列をDateに変換
 */
function parseDate(dateStr: string): Date {
  // YYYY-MM-DD形式を想定
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    // パース失敗時は現在日時
    console.warn(`[parseDate] Invalid date string: ${dateStr}`);
    return new Date();
  }
  return parsed;
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
   */
  loadMasters: async () => {
    set({ isLoading: true, error: null });
    try {
      const [fullHistoryMasters, implementationMasters] = await Promise.all([
        masterRepository.getAllFullHistoryMasters(),
        masterRepository.getAllImplementationMasters(),
      ]);
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
      // 1. CsvRecord → CsvInputRecord に変換
      const inputRecords = csvRecords.map(csvRecordToInput);

      // 2. Domain層: フル履歴マスターにマージ
      const updatedFullHistory = batchMergeFullHistoryMasters(
        fullHistoryMasters,
        inputRecords
      );

      // 3. Domain層: 実施マスターを導出
      const updatedImplementation = deriveImplementationMasters(
        updatedFullHistory,
        implementationMasters
      );

      // 4. Infrastructure層: IndexedDBに保存
      await masterRepository.saveAllMastersBatch(
        updatedFullHistory,
        updatedImplementation
      );

      // 5. ストアを更新
      set({
        fullHistoryMasters: updatedFullHistory,
        implementationMasters: updatedImplementation,
        isLoading: false,
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
