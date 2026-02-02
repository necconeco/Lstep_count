/**
 * Store層 - 担当者（スタッフ）マスターストア
 *
 * 責務:
 * - 担当者マスターの管理
 * - CSVからの担当者自動抽出
 * - 手動での担当者追加・編集・削除
 */

import { create } from 'zustand';
import type { StaffMaster } from '../domain';
import * as repository from '../infrastructure';

// ============================================================================
// ストア型定義
// ============================================================================

export interface StaffStoreState {
  // データ
  staffList: StaffMaster[];

  // 状態
  isLoading: boolean;
  error: string | null;

  // アクション
  initialize: () => Promise<void>;
  loadStaffList: () => Promise<void>;

  // CRUD
  addStaff: (staff: Omit<StaffMaster, 'staffId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateStaff: (staffId: string, updates: Partial<StaffMaster>) => Promise<void>;
  deleteStaff: (staffId: string) => Promise<void>;

  // CSVから担当者を自動抽出して追加
  extractAndMergeFromCSV: (staffNames: string[]) => Promise<{ added: number; skipped: number }>;

  // ゲッター
  getStaffById: (staffId: string) => StaffMaster | undefined;
  getStaffByName: (name: string) => StaffMaster | undefined;
  getActiveStaffList: () => StaffMaster[];

  // おまかせ予約の担当者割り当て
  assignStaffToOmakase: (reservationId: string, staffId: string) => Promise<void>;

  // エラークリア
  clearError: () => void;
}

// ============================================================================
// ユーティリティ
// ============================================================================

/**
 * スタッフIDを生成（UUID風）
 */
function generateStaffId(): string {
  return `staff_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 担当者名が既存リストに含まれるかチェック（エイリアスも考慮）
 */
function findExistingStaff(staffList: StaffMaster[], name: string): StaffMaster | undefined {
  return staffList.find(staff => staff.staffName === name || staff.aliases.some(alias => alias === name));
}

// ============================================================================
// ストア作成
// ============================================================================

export const useStaffStore = create<StaffStoreState>((set, get) => ({
  staffList: [],
  isLoading: false,
  error: null,

  /**
   * 初期化
   */
  initialize: async () => {
    await get().loadStaffList();
  },

  /**
   * 担当者リスト読み込み
   */
  loadStaffList: async () => {
    set({ isLoading: true, error: null });
    try {
      const staffList = await repository.getAllStaff();
      // sortOrder順にソート
      staffList.sort((a, b) => a.sortOrder - b.sortOrder);
      set({ staffList, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '担当者リストの読み込みに失敗しました',
        isLoading: false,
      });
    }
  },

  /**
   * 担当者追加
   */
  addStaff: async staffData => {
    const { staffList } = get();
    const now = new Date();

    // 重複チェック
    const existing = findExistingStaff(staffList, staffData.staffName);
    if (existing) {
      set({ error: `担当者「${staffData.staffName}」は既に登録されています` });
      return;
    }

    const newStaff: StaffMaster = {
      ...staffData,
      staffId: generateStaffId(),
      sortOrder: staffData.sortOrder ?? staffList.length,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await repository.saveStaff(newStaff);
      set({ staffList: [...staffList, newStaff].sort((a, b) => a.sortOrder - b.sortOrder) });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '担当者の追加に失敗しました',
      });
    }
  },

  /**
   * 担当者更新
   */
  updateStaff: async (staffId, updates) => {
    const { staffList } = get();
    const existingStaff = staffList.find(s => s.staffId === staffId);
    if (!existingStaff) {
      set({ error: '担当者が見つかりません' });
      return;
    }

    const updatedStaff: StaffMaster = {
      staffId: existingStaff.staffId,
      staffName: updates.staffName ?? existingStaff.staffName,
      aliases: updates.aliases ?? existingStaff.aliases,
      isActive: updates.isActive ?? existingStaff.isActive,
      sortOrder: updates.sortOrder ?? existingStaff.sortOrder,
      createdAt: existingStaff.createdAt,
      updatedAt: new Date(),
    };

    try {
      await repository.saveStaff(updatedStaff);
      const newList = staffList.map(s => (s.staffId === staffId ? updatedStaff : s));
      set({ staffList: newList.sort((a, b) => a.sortOrder - b.sortOrder) });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '担当者の更新に失敗しました',
      });
    }
  },

  /**
   * 担当者削除
   */
  deleteStaff: async staffId => {
    const { staffList } = get();
    try {
      await repository.deleteStaff(staffId);
      set({ staffList: staffList.filter(s => s.staffId !== staffId) });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '担当者の削除に失敗しました',
      });
    }
  },

  /**
   * CSVから担当者を自動抽出してマージ
   */
  extractAndMergeFromCSV: async staffNames => {
    const { staffList } = get();
    const now = new Date();
    let added = 0;
    let skipped = 0;

    // 重複を除去
    const uniqueNames = [...new Set(staffNames.filter(name => name && name.trim()))];

    const newStaffList: StaffMaster[] = [];

    for (const name of uniqueNames) {
      const existing = findExistingStaff(staffList, name);
      if (existing) {
        skipped++;
        continue;
      }

      // 新規追加する担当者がnewStaffListにも存在しないかチェック
      const alreadyAdded = newStaffList.find(s => s.staffName === name);
      if (alreadyAdded) {
        skipped++;
        continue;
      }

      const newStaff: StaffMaster = {
        staffId: generateStaffId(),
        staffName: name,
        aliases: [],
        isActive: true,
        sortOrder: staffList.length + newStaffList.length,
        createdAt: now,
        updatedAt: now,
      };
      newStaffList.push(newStaff);
      added++;
    }

    if (newStaffList.length > 0) {
      try {
        // バッチ保存（N+1問題解消）
        await repository.saveStaffBatch(newStaffList);
        set({
          staffList: [...staffList, ...newStaffList].sort((a, b) => a.sortOrder - b.sortOrder),
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : '担当者の自動抽出に失敗しました',
        });
      }
    }

    return { added, skipped };
  },

  /**
   * IDで担当者を取得
   */
  getStaffById: staffId => {
    return get().staffList.find(s => s.staffId === staffId);
  },

  /**
   * 名前で担当者を取得（エイリアスも検索）
   */
  getStaffByName: name => {
    return findExistingStaff(get().staffList, name);
  },

  /**
   * アクティブな担当者リストを取得
   */
  getActiveStaffList: () => {
    return get().staffList.filter(s => s.isActive);
  },

  /**
   * おまかせ予約に担当者を割り当て
   * 注: 実際の予約更新はhistoryStoreで行う。ここでは担当者の存在確認のみ
   */
  assignStaffToOmakase: async (reservationId, staffId) => {
    const staff = get().getStaffById(staffId);
    if (!staff) {
      set({ error: '指定された担当者が見つかりません' });
      return;
    }
    // 実際の予約更新はhistoryStoreで行う（準備完了のマーク）
    void reservationId; // 将来的にhistoryStoreと連携
  },

  /**
   * エラークリア
   */
  clearError: () => {
    set({ error: null });
  },
}));
