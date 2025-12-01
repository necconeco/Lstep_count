/**
 * 要確認リスト管理ストア
 * 検出ロジックは Phase 5 で実装
 */
import { create } from 'zustand';
import type {
  ReviewStoreState,
  CsvRecord,
  UserHistoryMaster,
  ReviewRecord,
  CancellationRecord,
} from '../types';

export const useReviewStore = create<ReviewStoreState>((set) => ({
  reviewRecords: [],
  cancellationRecords: [],
  isProcessing: false,
  error: null,

  detectReviewRecords: (csvData: CsvRecord[], _masterData: Map<string, UserHistoryMaster>) => {
    set({ isProcessing: true, error: null });

    try {
      // TODO: Phase 5で実際の検出ロジックを実装
      // 現在はモックデータを返す

      const mockReviewRecords: ReviewRecord[] = [];
      const mockCancellationRecords: CancellationRecord[] = [];

      // パターン1のモック: キャンセル済みだが来店済み（データ不整合）
      if (csvData.length > 0) {
        mockReviewRecords.push({
          pattern: 'pattern1',
          patternName: 'パターン1: データ不整合',
          record: csvData[0]!,
          reason: 'ステータスが「キャンセル済み」ですが、来店/来場が「済み」になっています',
        });
      }

      // パターン2のモック: 予約済みだが未来店
      if (csvData.length > 1) {
        mockReviewRecords.push({
          pattern: 'pattern2',
          patternName: 'パターン2: 未来店',
          record: csvData[1]!,
          reason: 'ステータスが「予約済み」ですが、来店/来場が「なし」です',
        });
      }

      // パターン3のモック: キャンセル済みで未来店（通常キャンセル）
      if (csvData.length > 2) {
        mockReviewRecords.push({
          pattern: 'pattern3',
          patternName: 'パターン3: 通常キャンセル',
          record: csvData[2]!,
          reason: 'ステータスが「キャンセル済み」で来店/来場が「なし」です',
        });
      }

      // キャンセル一覧のモック
      if (csvData.length > 0) {
        mockCancellationRecords.push({
          record: csvData[0]!,
          visitType: '初回',
          cancellationDate: '2025-12-01',
        });
      }

      set({
        reviewRecords: mockReviewRecords,
        cancellationRecords: mockCancellationRecords,
        isProcessing: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '要確認リストの検出に失敗しました',
        isProcessing: false,
      });
    }
  },

  clearReviewRecords: () => {
    set({
      reviewRecords: [],
      cancellationRecords: [],
      error: null,
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
