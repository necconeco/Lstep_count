/**
 * Store層 - スナップショットストア
 *
 * 責務:
 * - 集計結果のスナップショット保存
 * - スナップショットの取得・削除
 * - フォルダ管理
 * - ピン留め機能
 */

import { create } from 'zustand';
import type { AggregationSnapshot, SnapshotFolder, SnapshotType, TargetDateType } from '../domain';
import * as repository from '../infrastructure';

// ============================================================================
// ストア型定義
// ============================================================================

export interface SnapshotStoreState {
  // データ
  snapshots: AggregationSnapshot[];
  folders: SnapshotFolder[];

  // 状態
  isLoading: boolean;
  error: string | null;

  // アクション
  initialize: () => Promise<void>;
  loadSnapshots: () => Promise<void>;
  loadFolders: () => Promise<void>;

  // スナップショットCRUD
  saveSnapshot: (params: {
    type: SnapshotType;
    label: string;
    dateBaseType: TargetDateType;
    periodFrom: Date;
    periodTo: Date;
    payload: unknown;
    campaignId?: string;
    folderName?: string;
    createdBy?: string;
  }) => Promise<string>;
  deleteSnapshot: (id: string) => Promise<void>;
  updateSnapshotLabel: (id: string, newLabel: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  moveToFolder: (id: string, folderName: string | null) => Promise<void>;

  // フォルダCRUD
  createFolder: (name: string) => Promise<void>;
  deleteFolder: (name: string) => Promise<void>;
  renameFolder: (oldName: string, newName: string) => Promise<void>;

  // ゲッター
  getSnapshotById: (id: string) => AggregationSnapshot | undefined;
  getSnapshotsByFolder: (folderName: string | null) => AggregationSnapshot[];
  getSnapshotsByType: (type: SnapshotType) => AggregationSnapshot[];
  getPinnedSnapshots: () => AggregationSnapshot[];

  // エラークリア
  clearError: () => void;
}

// ============================================================================
// ユーティリティ
// ============================================================================

/**
 * スナップショットIDを生成
 */
function generateSnapshotId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// ストア作成
// ============================================================================

export const useSnapshotStore = create<SnapshotStoreState>((set, get) => ({
  snapshots: [],
  folders: [],
  isLoading: false,
  error: null,

  /**
   * 初期化
   */
  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([get().loadSnapshots(), get().loadFolders()]);
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '初期化に失敗しました',
        isLoading: false,
      });
    }
  },

  /**
   * スナップショット読み込み
   */
  loadSnapshots: async () => {
    try {
      const snapshots = await repository.getAllSnapshots();
      // 作成日降順でソート
      snapshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      set({ snapshots });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'スナップショットの読み込みに失敗しました',
      });
    }
  },

  /**
   * フォルダ読み込み
   */
  loadFolders: async () => {
    try {
      const folders = await repository.getAllFolders();
      set({ folders });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'フォルダの読み込みに失敗しました',
      });
    }
  },

  /**
   * スナップショット保存
   */
  saveSnapshot: async params => {
    const now = new Date();
    const id = generateSnapshotId();

    const snapshot: AggregationSnapshot = {
      id,
      type: params.type,
      label: params.label,
      dateBaseType: params.dateBaseType,
      periodFrom: params.periodFrom,
      periodTo: params.periodTo,
      campaignId: params.campaignId,
      payload: params.payload,
      folderName: params.folderName || null,
      isPinned: false,
      createdAt: now,
      createdBy: params.createdBy || 'user',
      updatedAt: now,
    };

    try {
      await repository.saveSnapshot(snapshot);
      set(state => ({
        snapshots: [snapshot, ...state.snapshots],
      }));
      return id;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'スナップショットの保存に失敗しました',
      });
      throw error;
    }
  },

  /**
   * スナップショット削除
   */
  deleteSnapshot: async id => {
    try {
      await repository.deleteSnapshot(id);
      set(state => ({
        snapshots: state.snapshots.filter(s => s.id !== id),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'スナップショットの削除に失敗しました',
      });
    }
  },

  /**
   * スナップショットラベル更新
   */
  updateSnapshotLabel: async (id, newLabel) => {
    const { snapshots } = get();
    const snapshot = snapshots.find(s => s.id === id);
    if (!snapshot) {
      set({ error: 'スナップショットが見つかりません' });
      return;
    }

    const updated: AggregationSnapshot = {
      ...snapshot,
      label: newLabel,
      updatedAt: new Date(),
    };

    try {
      await repository.saveSnapshot(updated);
      set(state => ({
        snapshots: state.snapshots.map(s => (s.id === id ? updated : s)),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'ラベルの更新に失敗しました',
      });
    }
  },

  /**
   * ピン留めトグル
   */
  togglePin: async id => {
    const { snapshots } = get();
    const snapshot = snapshots.find(s => s.id === id);
    if (!snapshot) {
      set({ error: 'スナップショットが見つかりません' });
      return;
    }

    const updated: AggregationSnapshot = {
      ...snapshot,
      isPinned: !snapshot.isPinned,
      updatedAt: new Date(),
    };

    try {
      await repository.saveSnapshot(updated);
      set(state => ({
        snapshots: state.snapshots.map(s => (s.id === id ? updated : s)),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'ピン留めの切り替えに失敗しました',
      });
    }
  },

  /**
   * フォルダに移動
   */
  moveToFolder: async (id, folderName) => {
    const { snapshots } = get();
    const snapshot = snapshots.find(s => s.id === id);
    if (!snapshot) {
      set({ error: 'スナップショットが見つかりません' });
      return;
    }

    const updated: AggregationSnapshot = {
      ...snapshot,
      folderName,
      updatedAt: new Date(),
    };

    try {
      await repository.saveSnapshot(updated);
      set(state => ({
        snapshots: state.snapshots.map(s => (s.id === id ? updated : s)),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'フォルダへの移動に失敗しました',
      });
    }
  },

  /**
   * フォルダ作成
   */
  createFolder: async name => {
    const { folders } = get();
    if (folders.some(f => f.folderName === name)) {
      set({ error: '同名のフォルダが既に存在します' });
      return;
    }

    const now = new Date();
    const folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const folder: SnapshotFolder = {
      folderId,
      folderName: name,
      sortOrder: folders.length,
      createdAt: now,
    };

    try {
      await repository.saveFolder(folder);
      set(state => ({
        folders: [...state.folders, folder],
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'フォルダの作成に失敗しました',
      });
    }
  },

  /**
   * フォルダ削除
   */
  deleteFolder: async name => {
    const { snapshots, folders } = get();
    const folder = folders.find(f => f.folderName === name);
    if (!folder) {
      set({ error: 'フォルダが見つかりません' });
      return;
    }

    // フォルダ内のスナップショットを未分類に移動
    const snapshotsInFolder = snapshots.filter(s => s.folderName === name);
    for (const snapshot of snapshotsInFolder) {
      const updated: AggregationSnapshot = {
        ...snapshot,
        folderName: null,
        updatedAt: new Date(),
      };
      await repository.saveSnapshot(updated);
    }

    try {
      await repository.deleteFolder(folder.folderId);
      set(state => ({
        folders: state.folders.filter(f => f.folderName !== name),
        snapshots: state.snapshots.map(s => (s.folderName === name ? { ...s, folderName: null } : s)),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'フォルダの削除に失敗しました',
      });
    }
  },

  /**
   * フォルダ名変更
   */
  renameFolder: async (oldName, newName) => {
    const { folders, snapshots } = get();
    const folder = folders.find(f => f.folderName === oldName);
    if (!folder) {
      set({ error: 'フォルダが見つかりません' });
      return;
    }

    if (folders.some(f => f.folderName === newName)) {
      set({ error: '同名のフォルダが既に存在します' });
      return;
    }

    // 新しいフォルダを作成
    const newFolder: SnapshotFolder = {
      ...folder,
      folderName: newName,
    };

    // スナップショットのフォルダ名を更新
    const updatedSnapshots = snapshots.filter(s => s.folderName === oldName);
    for (const snapshot of updatedSnapshots) {
      const updated: AggregationSnapshot = {
        ...snapshot,
        folderName: newName,
        updatedAt: new Date(),
      };
      await repository.saveSnapshot(updated);
    }

    try {
      await repository.saveFolder(newFolder);
      set(state => ({
        folders: state.folders.map(f => (f.folderName === oldName ? newFolder : f)),
        snapshots: state.snapshots.map(s => (s.folderName === oldName ? { ...s, folderName: newName } : s)),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'フォルダ名の変更に失敗しました',
      });
    }
  },

  // ============================================================================
  // ゲッター
  // ============================================================================

  getSnapshotById: id => {
    return get().snapshots.find(s => s.id === id);
  },

  getSnapshotsByFolder: folderName => {
    return get().snapshots.filter(s => s.folderName === folderName);
  },

  getSnapshotsByType: type => {
    return get().snapshots.filter(s => s.type === type);
  },

  getPinnedSnapshots: () => {
    return get().snapshots.filter(s => s.isPinned);
  },

  clearError: () => {
    set({ error: null });
  },
}));
