/**
 * 集計結果管理ストア
 * 実際のデータ処理ロジック使用
 * Phase 6: 履歴保存機能追加
 */
import { create } from 'zustand';
import type {
  AggregationStoreState,
  CsvRecord,
  UserHistoryMaster,
  AggregationHistory,
} from '../types';
import { aggregateAll } from '../utils/dataAggregator';
import { saveHistory } from '../utils/aggregationHistoryManager';

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

      // 集計履歴をIndexedDBに保存
      if (results.monthlyResults.length > 0 && results.monthlyResults[0]) {
        const month = results.monthlyResults[0].month; // 最初の月別結果から月を取得
        const id = month.replace('-', ''); // YYYYMM形式に変換

        const history: AggregationHistory = {
          id,
          month,
          summary: results.summary,
          staffResults: results.staffResults,
          dailyResults: results.dailyResults,
          monthlyResults: results.monthlyResults,
          spreadsheetData: results.spreadsheetData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          await saveHistory(history);
        } catch (historyError) {
          console.warn('履歴保存に失敗しました:', historyError);
          // 履歴保存失敗はエラーとして扱わない（集計結果は表示可能）
        }
      }
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
