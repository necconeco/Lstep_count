/**
 * 集計結果管理ストア
 * 実際のデータ処理ロジック使用
 */
import { create } from 'zustand';
import type {
  AggregationStoreState,
  CsvRecord,
  UserHistoryMaster,
} from '../types';
import { aggregateAll } from '../utils/dataAggregator';

export const useAggregationStore = create<AggregationStoreState>((set) => ({
  summary: null,
  staffResults: [],
  dailyResults: [],
  monthlyResults: [],
  spreadsheetData: null,
  isProcessing: false,
  error: null,

  processData: async (csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>) => {
    set({ isProcessing: true, error: null });

    try {
      // 実際の集計処理を実行
      const results = aggregateAll(csvData, masterData);

      set({
        summary: results.summary,
        staffResults: results.staffResults,
        dailyResults: results.dailyResults,
        monthlyResults: results.monthlyResults,
        spreadsheetData: results.spreadsheetData,
        isProcessing: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'データ処理に失敗しました',
        isProcessing: false,
      });
    }
  },

  clearResults: () => {
    set({
      summary: null,
      staffResults: [],
      dailyResults: [],
      monthlyResults: [],
      spreadsheetData: null,
      error: null,
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
