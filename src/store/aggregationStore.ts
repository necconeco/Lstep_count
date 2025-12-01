/**
 * 集計結果管理ストア
 * データ処理ロジックは Phase 5 で実装
 */
import { create } from 'zustand';
import type {
  AggregationStoreState,
  CsvRecord,
  UserHistoryMaster,
  AggregationSummary,
  StaffResult,
  DailyResult,
  MonthlyResult,
  SpreadsheetOutputData,
} from '../types';

export const useAggregationStore = create<AggregationStoreState>((set) => ({
  summary: null,
  staffResults: [],
  dailyResults: [],
  monthlyResults: [],
  spreadsheetData: null,
  isProcessing: false,
  error: null,

  processData: async (csvData: CsvRecord[], _masterData: Map<string, UserHistoryMaster>) => {
    set({ isProcessing: true, error: null });

    try {
      // TODO: Phase 5で実際の集計ロジックを実装
      // 現在はモックデータを返す

      // モックサマリー
      const mockSummary: AggregationSummary = {
        totalApplications: csvData.length,
        totalImplementations: Math.floor(csvData.length * 0.8),
        totalCancellations: Math.floor(csvData.length * 0.2),
        implementationRate: 80.0,
        firstTimeApplications: Math.floor(csvData.length * 0.6),
        firstTimeApplicationRate: 60.0,
        firstTimeImplementations: Math.floor(csvData.length * 0.5),
        firstTimeImplementationRate: 50.0,
        repeatApplications: Math.floor(csvData.length * 0.4),
        repeatApplicationRate: 40.0,
        repeatImplementations: Math.floor(csvData.length * 0.3),
        repeatImplementationRate: 30.0,
      };

      // モック相談員別実績
      const mockStaffResults: StaffResult[] = [
        {
          staffName: '相談員A',
          applications: 30,
          implementations: 25,
          cancellations: 5,
          implementationRate: 83.3,
          firstTimeCount: 18,
          repeatCount: 12,
        },
        {
          staffName: '相談員B',
          applications: 25,
          implementations: 20,
          cancellations: 5,
          implementationRate: 80.0,
          firstTimeCount: 15,
          repeatCount: 10,
        },
      ];

      // モック日別集計
      const mockDailyResults: DailyResult[] = [
        {
          date: '2025-12-01',
          applications: 10,
          implementations: 8,
          cancellations: 2,
          firstTimeCount: 6,
          repeatCount: 4,
        },
        {
          date: '2025-12-02',
          applications: 12,
          implementations: 10,
          cancellations: 2,
          firstTimeCount: 7,
          repeatCount: 5,
        },
      ];

      // モック月別集計
      const mockMonthlyResults: MonthlyResult[] = [
        {
          month: '2025-12',
          applications: csvData.length,
          implementations: Math.floor(csvData.length * 0.8),
          cancellations: Math.floor(csvData.length * 0.2),
          implementationRate: 80.0,
        },
      ];

      // モックスプレッドシートデータ
      const mockSpreadsheetData: SpreadsheetOutputData = {
        AB: mockSummary.firstTimeApplications,
        AC: mockSummary.firstTimeApplicationRate,
        AD: mockSummary.firstTimeImplementations,
        AE: mockSummary.firstTimeImplementationRate,
        AJ: mockSummary.repeatApplications,
        AK: mockSummary.repeatApplicationRate,
        AL: mockSummary.repeatImplementations,
        AM: mockSummary.repeatImplementationRate,
      };

      set({
        summary: mockSummary,
        staffResults: mockStaffResults,
        dailyResults: mockDailyResults,
        monthlyResults: mockMonthlyResults,
        spreadsheetData: mockSpreadsheetData,
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
