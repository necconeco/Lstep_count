/**
 * CSVデータ管理ストア
 */
import { create } from 'zustand';
import type { CsvStoreState, CsvRecord } from '../types';
import { extractAvailableMonths, filterDataByMonth, getLatestMonth } from '../utils/monthFilter';

export const useCsvStore = create<CsvStoreState>((set, get) => ({
  csvData: [],
  isLoading: false,
  error: null,
  fileName: null,
  uploadedAt: null,
  selectedMonth: null,
  availableMonths: [],

  setCsvData: (data: CsvRecord[], fileName: string) => {
    // 利用可能な月を抽出
    const months = extractAvailableMonths(data);
    // 最新の月を自動選択
    const latestMonth = getLatestMonth(months);

    set({
      csvData: data,
      fileName,
      uploadedAt: new Date(),
      error: null,
      availableMonths: months,
      selectedMonth: latestMonth,
    });
  },

  updateRecord: (予約ID: string, updates: Partial<CsvRecord>) => {
    set((state) => ({
      csvData: state.csvData.map((record) =>
        record.予約ID === 予約ID ? { ...record, ...updates } : record
      ),
    }));
  },

  clearCsvData: () => {
    set({
      csvData: [],
      fileName: null,
      uploadedAt: null,
      error: null,
      selectedMonth: null,
      availableMonths: [],
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setSelectedMonth: (month: string | null) => {
    set({ selectedMonth: month });
  },

  setAvailableMonths: (months: string[]) => {
    set({ availableMonths: months });
  },

  getFilteredData: () => {
    const { csvData, selectedMonth } = get();
    return filterDataByMonth(csvData, selectedMonth);
  },
}));
