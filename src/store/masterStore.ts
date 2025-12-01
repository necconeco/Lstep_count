/**
 * 履歴マスタデータ管理ストア
 * IndexedDB連携は Phase 5 で実装
 */
import { create } from 'zustand';
import type { MasterStoreState, UserHistoryMaster } from '../types';

export const useMasterStore = create<MasterStoreState>((set, get) => ({
  masterData: new Map<string, UserHistoryMaster>(),
  isLoading: false,
  error: null,

  loadMasterData: async () => {
    set({ isLoading: true, error: null });
    try {
      // TODO: Phase 5でIndexedDBからの読み込みを実装
      // 現在はモックデータで初期化
      const mockData = new Map<string, UserHistoryMaster>();
      set({ masterData: mockData, isLoading: false });
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

      const newMasterData = new Map(masterData);
      newMasterData.set(friendId, updated);

      // TODO: Phase 5でIndexedDBへの保存を実装
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
      // TODO: Phase 5でIndexedDBのクリアを実装
      set({ masterData: new Map(), error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '履歴マスタのクリアに失敗しました',
      });
    }
  },
}));
