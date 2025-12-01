/**
 * 履歴マスタデータ管理ストア
 * IndexedDB連携
 */
import { create } from 'zustand';
import type { MasterStoreState, UserHistoryMaster } from '../types';
import * as masterDataManager from '../utils/masterDataManager';

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

  updateMasterData: async (friendId: string, implementationDate: Date) => {
    try {
      const { masterData } = get();
      const existing = masterData.get(friendId);

      const updated: UserHistoryMaster = existing
        ? {
            ...existing,
            implementationCount: existing.implementationCount + 1,
            lastImplementationDate: implementationDate,
            updatedAt: new Date(),
          }
        : {
            friendId,
            implementationCount: 1,
            lastImplementationDate: implementationDate,
            createdAt: new Date(),
            updatedAt: new Date(),
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
}));
