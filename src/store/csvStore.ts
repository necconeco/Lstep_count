/**
 * CSVデータ管理ストア
 */
import { create } from 'zustand';
import type { CsvStoreState, CsvRecord } from '../types';

export const useCsvStore = create<CsvStoreState>((set) => ({
  csvData: [],
  isLoading: false,
  error: null,
  fileName: null,
  uploadedAt: null,

  setCsvData: (data: CsvRecord[], fileName: string) => {
    set({
      csvData: data,
      fileName,
      uploadedAt: new Date(),
      error: null,
    });
  },

  clearCsvData: () => {
    set({
      csvData: [],
      fileName: null,
      uploadedAt: null,
      error: null,
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },
}));
