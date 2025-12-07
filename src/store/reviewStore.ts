/**
 * 要確認リスト管理ストア
 * 実際の検出ロジック使用
 */
import { create } from 'zustand';
import type { ReviewStoreState, CsvRecord, UserHistoryMaster } from '../types';
import { detectAllReviewRecords, generateCancellationList } from '../utils/reviewDetector';

export const useReviewStore = create<ReviewStoreState>(set => ({
  reviewRecords: [],
  cancellationRecords: [],
  isProcessing: false,
  error: null,

  detectReviewRecords: (csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>) => {
    set({ isProcessing: true, error: null });

    try {
      // 実際の検出ロジックを実行
      const reviewRecords = detectAllReviewRecords(csvData);
      const cancellationRecords = generateCancellationList(csvData, masterData);

      set({
        reviewRecords,
        cancellationRecords,
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
