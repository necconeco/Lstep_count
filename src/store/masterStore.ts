/**
 * 履歴マスタデータ管理ストア
 * IndexedDB連携
 */
import { create } from 'zustand';
import type { MasterStoreState, UserHistoryMaster, CsvRecord } from '../types';
import * as masterDataManager from '../utils/masterDataManager';
import { updateMasterData } from '../utils/dataAggregator';

export const useMasterStore = create<MasterStoreState>((set, get) => ({
  masterData: new Map<string, UserHistoryMaster>(),
  isLoading: false,
  error: null,

  loadMasterData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await masterDataManager.getAllMasterData();
      set({ masterData: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '履歴マスタの読み込みに失敗しました',
        isLoading: false,
      });
    }
  },

  updateMasterData: async (
    friendId: string,
    implementationDate: Date,
    reservationId = '',
    status = '',
    staff?: string
  ) => {
    try {
      const { masterData } = get();
      const existing = masterData.get(friendId);
      const now = new Date();

      const updated: UserHistoryMaster = existing
        ? {
            ...existing,
            implementationHistory: [
              ...existing.implementationHistory,
              {
                date: implementationDate,
                reservationId,
                status,
                staff,
              },
            ].sort((a, b) => a.date.getTime() - b.date.getTime()),
            implementationCount: existing.implementationCount + 1,
            lastImplementationDate: implementationDate,
            lastStaff: staff || existing.lastStaff,
            updatedAt: now,
          }
        : {
            friendId,
            allHistory: [],
            implementationHistory: [
              {
                date: implementationDate,
                reservationId,
                status,
                staff,
              },
            ],
            implementationCount: 1,
            lastImplementationDate: implementationDate,
            lastStaff: staff || null,
            createdAt: now,
            updatedAt: now,
          };

      // IndexedDBに保存
      await masterDataManager.saveMasterRecord(updated);

      // ストアを更新
      const newMasterData = new Map(masterData);
      newMasterData.set(friendId, updated);
      set({ masterData: newMasterData });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '履歴マスタの更新に失敗しました',
      });
    }
  },

  getMasterRecord: (friendId: string) => {
    const { masterData } = get();
    return masterData.get(friendId) || null;
  },

  deleteMasterEntry: async (friendId: string) => {
    try {
      await masterDataManager.deleteMasterRecord(friendId);
      const { masterData } = get();
      const newMasterData = new Map(masterData);
      newMasterData.delete(friendId);
      set({ masterData: newMasterData, error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '履歴マスタの削除に失敗しました',
      });
    }
  },

  clearMasterData: async () => {
    try {
      await masterDataManager.clearAllMasterData();
      set({ masterData: new Map(), error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '履歴マスタのクリアに失敗しました',
      });
    }
  },

  /**
   * 月次CSV処理後のマスターデータ更新（ユースケース関数）
   * Domain層の updateMasterData を呼び出し、Infrastructure層に保存、ストアを再読み込み
   */
  processAndUpdateMaster: async (csvData: CsvRecord[]) => {
    const { masterData, loadMasterData } = get();
    try {
      // Domain層: 新しいマスターデータを生成
      const updatedMasterData = updateMasterData(csvData, masterData);

      // Infrastructure層: IndexedDBに保存
      await masterDataManager.saveMasterDataBatch(updatedMasterData);

      // ストアを再読み込み
      await loadMasterData();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'マスターデータの更新処理に失敗しました',
      });
      throw error;
    }
  },
}));
