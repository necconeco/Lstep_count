/**
 * Store層 - 履歴ストア（新設計）
 *
 * 責務:
 * - CSVデータの蓄積
 * - 履歴の取得・フィルタ
 * - CSV出力
 * - 手動編集（担当者変更、ステータス変更、同日統合）
 * - 監査ログ記録
 */

import { create } from 'zustand';
import type { CsvRecord } from '../types';
import type {
  ReservationHistory,
  UserVisitCount,
  CampaignMaster,
  AggregationSummary,
  DailyAggregation,
  FlatRecord,
  TargetDateType,
  AuditLog,
  ImplementationRule,
} from '../domain';
import {
  mergeCsvToHistories,
  recalculateAllVisitIndexes,
  filterByPeriod,
  filterByCampaign,
  calculateSummary,
  calculateDailyAggregation,
  historiesToFlatRecords,
  flatRecordsToCSV,
  getVisitLabel,
  formatDate,
  parseLocalDate,
} from '../domain';
import * as repository from '../infrastructure';
import { broadcastSync, onSyncMessage, initTabSync, type SyncMessage } from '../utils/tabSync';
import { toCsvInputRecord, generateAuditLogId, generateGroupId } from '../adapters';

// ============================================================================
// ヘルパー関数
// ============================================================================

/**
 * JSON/IndexedDBから復元した日付をローカルタイムゾーンで正しく復元
 *
 * JSON.stringifyでDateは ISO文字列（例: "2025-02-01T00:00:00.000Z"）になる。
 * new Date()でこれをパースするとUTCとして解釈され、
 * 日本時間では前日の23時になってしまう問題を解決する。
 *
 * @param dateValue ISO文字列、Date、または日付文字列
 * @param isDateOnly trueの場合は日付部分のみ抽出してローカルタイムゾーンで復元
 */
function restoreDate(dateValue: string | Date, isDateOnly: boolean = false): Date {
  const str = typeof dateValue === 'string' ? dateValue : dateValue.toISOString();

  if (isDateOnly) {
    // YYYY-MM-DD部分のみ抽出してローカルタイムゾーンで復元
    const datePart = str.split('T')[0];
    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return parseLocalDate(datePart);
    }
  }

  // タイムスタンプ付きの日時はそのままnew Dateで復元
  return new Date(str);
}

// ============================================================================
// ストア型定義
// ============================================================================

export interface HistoryStoreState {
  // データ
  histories: Map<string, ReservationHistory>;
  userCounts: Map<string, UserVisitCount>;
  campaigns: CampaignMaster[];
  auditLogs: AuditLog[];

  // 状態
  isLoading: boolean;
  error: string | null;

  // 選択中のキャンペーン
  selectedCampaignId: string | null;

  // アクション
  initialize: () => Promise<void>;
  loadData: () => Promise<void>;
  mergeCsvData: (csvRecords: CsvRecord[]) => Promise<void>;
  recalculateVisitIndexes: () => Promise<void>;
  clearAllData: () => Promise<void>;

  // キャンペーン操作
  selectCampaign: (campaignId: string | null) => void;
  addCampaign: (campaign: Omit<CampaignMaster, 'createdAt' | 'updatedAt'>) => Promise<void>;

  // ゲッター
  getHistoryCount: () => number;
  getUserCount: () => number;
  getImplementationCount: (friendId: string) => number;
  getNextVisitLabel: (friendId: string) => '初回' | '2回目' | '3回目以降';
  getHistory: (reservationId: string) => ReservationHistory | undefined;

  // フィルタ・集計
  getFilteredRecords: (periodFrom: Date, periodTo: Date, dateType: TargetDateType) => ReservationHistory[];
  getFilteredByCampaign: (campaignId: string) => ReservationHistory[];
  getSummary: (
    periodFrom: Date,
    periodTo: Date,
    dateType: TargetDateType,
    implementationRule?: ImplementationRule
  ) => AggregationSummary;
  getDailyAggregation: (
    periodFrom: Date,
    periodTo: Date,
    dateType: TargetDateType,
    implementationRule?: ImplementationRule
  ) => DailyAggregation[];

  // 表示用
  getFlatRecords: () => FlatRecord[];
  exportToCSV: () => string;
  exportToJSON: () => string;

  // バックアップ・リストア
  importFromJSON: (jsonStr: string) => Promise<{ success: boolean; message: string }>;

  // 除外フラグ操作
  toggleExcluded: (reservationId: string) => Promise<void>;
  setExcluded: (reservationId: string, isExcluded: boolean) => Promise<void>;

  // ============================================================================
  // 手動編集アクション
  // ============================================================================

  /**
   * 予約に担当者を割り当て（おまかせ以外も可能）
   */
  assignStaff: (reservationId: string, staffName: string | null, changedBy?: string) => Promise<void>;

  /**
   * おまかせ予約に担当者を割り当て
   * @deprecated assignStaffを使用してください
   */
  assignStaffToOmakase: (reservationId: string, staffName: string, changedBy?: string) => Promise<void>;

  /**
   * 詳細ステータスを変更（前日キャンセル/当日キャンセル/通常キャンセル）
   */
  updateDetailStatus: (
    reservationId: string,
    detailStatus: '前日キャンセル' | '当日キャンセル' | '' | null,
    changedBy?: string
  ) => Promise<void>;

  /**
   * 実施済み/キャンセルをトグル
   */
  toggleImplementation: (reservationId: string, changedBy?: string) => Promise<void>;

  /**
   * 手動で実施/未実施を設定（null=自動判定に戻す）
   */
  setIsImplementedManual: (
    reservationId: string,
    isImplementedManual: boolean | null,
    changedBy?: string
  ) => Promise<void>;

  /**
   * 同日の予約を統合（groupId設定）
   */
  mergeReservations: (reservationIds: string[], primaryReservationId: string, changedBy?: string) => Promise<void>;

  /**
   * 予約の統合を解除
   */
  unmergeReservation: (reservationId: string, changedBy?: string) => Promise<void>;

  /**
   * キャンセル理由メモを更新
   */
  updateCancelReason: (reservationId: string, cancelReason: string | null, changedBy?: string) => Promise<void>;

  /**
   * キャンセル対応ステータスを更新
   */
  updateCancelHandlingStatus: (reservationId: string, status: import('../domain').CancelHandlingStatus | null, changedBy?: string) => Promise<void>;

  // ============================================================================
  // 監査ログ
  // ============================================================================

  /**
   * 監査ログを取得（予約ID指定）
   */
  getAuditLogsByReservation: (reservationId: string) => AuditLog[];

  /**
   * 全監査ログを取得（最新順）
   */
  getAllAuditLogs: (limit?: number) => AuditLog[];

  /**
   * 監査ログを読み込み
   */
  loadAuditLogs: () => Promise<void>;
}

// ============================================================================
// ストア作成
// ============================================================================

export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  histories: new Map(),
  userCounts: new Map(),
  campaigns: [],
  auditLogs: [],
  isLoading: false,
  error: null,
  selectedCampaignId: null,

  /**
   * 初期化（キャンペーンのデフォルト登録含む）
   */
  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      // タブ同期を初期化
      initTabSync();

      // 他タブからの同期メッセージをリッスン
      onSyncMessage('*', (message: SyncMessage) => {
        // 他タブでデータが変更されたらリロード
        if (
          message.type === 'DATA_CHANGED' ||
          message.type === 'HISTORY_UPDATED' ||
          message.type === 'BACKUP_RESTORED' ||
          message.type === 'DATA_CLEARED'
        ) {
          get().loadData();
        }
      });

      // デフォルトキャンペーンを登録
      await repository.initializeDefaultCampaigns();
      // データ読み込み
      await get().loadData();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '初期化に失敗しました',
        isLoading: false,
      });
    }
  },

  /**
   * データ読み込み
   */
  loadData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [histories, userCounts, campaigns] = await Promise.all([
        repository.getAllHistories(),
        repository.getAllUserCounts(),
        repository.getAllCampaigns(),
      ]);
      set({
        histories,
        userCounts,
        campaigns,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'データの読み込みに失敗しました',
        isLoading: false,
      });
    }
  },

  /**
   * CSVデータをマージ
   */
  mergeCsvData: async (csvRecords: CsvRecord[]) => {
    const { histories, userCounts } = get();
    set({ isLoading: true, error: null });

    try {
      // CsvRecord → CsvInputRecord に変換
      const inputRecords = csvRecords.map(toCsvInputRecord);

      // マージ処理
      const merged = mergeCsvToHistories(histories, userCounts, inputRecords);

      // IndexedDBに保存
      await Promise.all([
        repository.saveHistoriesBatch(merged.histories),
        repository.saveUserCountsBatch(merged.userCounts),
      ]);

      // ストア更新
      set({
        histories: merged.histories,
        userCounts: merged.userCounts,
        isLoading: false,
      });

      // 他タブに同期通知
      broadcastSync('DATA_CHANGED', { count: merged.histories.size, source: 'csv_merge' });
    } catch (error) {
      console.error('CSVマージエラー:', error);
      set({
        error: error instanceof Error ? error.message : 'CSVのマージに失敗しました',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * visitIndexを再計算
   */
  recalculateVisitIndexes: async () => {
    const { histories } = get();
    set({ isLoading: true, error: null });

    try {
      const recalculated = recalculateAllVisitIndexes(histories);

      // IndexedDBに保存
      await Promise.all([
        repository.saveHistoriesBatch(recalculated.histories),
        repository.saveUserCountsBatch(recalculated.userCounts),
      ]);

      // ストア更新
      set({
        histories: recalculated.histories,
        userCounts: recalculated.userCounts,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '再計算に失敗しました',
        isLoading: false,
      });
    }
  },

  /**
   * 全データクリア
   */
  clearAllData: async () => {
    set({ isLoading: true, error: null });
    try {
      await repository.clearAllData();
      set({
        histories: new Map(),
        userCounts: new Map(),
        isLoading: false,
      });

      // 他タブに同期通知
      broadcastSync('DATA_CLEARED');
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'クリアに失敗しました',
        isLoading: false,
      });
    }
  },

  /**
   * キャンペーン選択
   */
  selectCampaign: campaignId => {
    set({ selectedCampaignId: campaignId });
  },

  /**
   * キャンペーン追加
   */
  addCampaign: async campaignData => {
    const now = new Date();
    const campaign: CampaignMaster = {
      ...campaignData,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await repository.saveCampaign(campaign);
      const campaigns = await repository.getAllCampaigns();
      set({ campaigns });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'キャンペーンの追加に失敗しました',
      });
    }
  },

  // ============================================================================
  // ゲッター
  // ============================================================================

  getHistoryCount: () => get().histories.size,

  getUserCount: () => get().userCounts.size,

  getImplementationCount: friendId => {
    const userCount = get().userCounts.get(friendId);
    return userCount?.implementationCount ?? 0;
  },

  getNextVisitLabel: friendId => {
    const count = get().getImplementationCount(friendId);
    return getVisitLabel(count + 1);
  },

  getHistory: reservationId => {
    return get().histories.get(reservationId);
  },

  // ============================================================================
  // フィルタ・集計
  // ============================================================================

  getFilteredRecords: (periodFrom, periodTo, dateType) => {
    return filterByPeriod(get().histories, periodFrom, periodTo, dateType);
  },

  getFilteredByCampaign: campaignId => {
    const campaign = get().campaigns.find(c => c.campaignId === campaignId);
    if (!campaign) return [];
    return filterByCampaign(get().histories, campaign);
  },

  getSummary: (periodFrom, periodTo, dateType, implementationRule = 'includeLateCancel') => {
    const records = filterByPeriod(get().histories, periodFrom, periodTo, dateType);
    return calculateSummary(records, periodFrom, periodTo, dateType, implementationRule);
  },

  getDailyAggregation: (periodFrom, periodTo, dateType, implementationRule = 'includeLateCancel') => {
    const records = filterByPeriod(get().histories, periodFrom, periodTo, dateType);
    return calculateDailyAggregation(records, dateType, implementationRule);
  },

  // ============================================================================
  // 表示用
  // ============================================================================

  getFlatRecords: () => {
    return historiesToFlatRecords(get().histories);
  },

  exportToCSV: () => {
    const flatRecords = get().getFlatRecords();
    return flatRecordsToCSV(flatRecords);
  },

  /**
   * 全データをJSON形式でエクスポート
   * バックアップ・復元用
   */
  exportToJSON: () => {
    const { histories, userCounts, campaigns, auditLogs } = get();

    // Map/Setを配列に変換してJSON化可能にする
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        histories: Array.from(histories.values()),
        userCounts: Array.from(userCounts.values()),
        campaigns,
        auditLogs,
      },
    };

    return JSON.stringify(exportData, null, 2);
  },

  /**
   * JSONからデータをインポート（完全復元モード）
   * 現在のデータを全削除してからJSONのデータを復元
   */
  importFromJSON: async (jsonStr: string) => {
    set({ isLoading: true, error: null });

    try {
      // JSONパース
      const parsed = JSON.parse(jsonStr);

      // バージョンチェック
      if (!parsed.version || !parsed.data) {
        return { success: false, message: 'JSONフォーマットが不正です。バージョン情報またはデータが見つかりません。' };
      }

      const { histories, userCounts, campaigns, auditLogs } = parsed.data;

      // 必須データの存在チェック
      if (!Array.isArray(histories)) {
        return { success: false, message: 'historiesデータが不正です。' };
      }
      if (!Array.isArray(userCounts)) {
        return { success: false, message: 'userCountsデータが不正です。' };
      }

      // 日付文字列をDateオブジェクトに変換
      // sessionDateは日付のみなのでローカルタイムゾーンで復元（タイムゾーンずれ防止）
      const restoredHistories = new Map<string, ReservationHistory>();
      for (const h of histories) {
        const restored: ReservationHistory = {
          ...h,
          sessionDate: restoreDate(h.sessionDate, true), // 日付のみ（タイムゾーン対応）
          applicationDate: new Date(h.applicationDate), // タイムスタンプ付き
          createdAt: new Date(h.createdAt),
          updatedAt: new Date(h.updatedAt),
        };
        restoredHistories.set(restored.reservationId, restored);
      }

      const restoredUserCounts = new Map<string, UserVisitCount>();
      for (const u of userCounts) {
        const restored: UserVisitCount = {
          ...u,
          lastVisitDate: u.lastVisitDate ? new Date(u.lastVisitDate) : null,
        };
        restoredUserCounts.set(restored.friendId, restored);
      }

      const restoredCampaigns: CampaignMaster[] = (campaigns || []).map((c: CampaignMaster) => ({
        ...c,
        targetPeriodFrom: new Date(c.targetPeriodFrom),
        targetPeriodTo: new Date(c.targetPeriodTo),
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      }));

      const restoredAuditLogs: AuditLog[] = (auditLogs || []).map((a: AuditLog) => ({
        ...a,
        changedAt: new Date(a.changedAt),
      }));

      // 現在のデータを全削除
      await repository.clearAllData();

      // 復元したデータを保存
      await Promise.all([
        repository.saveHistoriesBatch(restoredHistories),
        repository.saveUserCountsBatch(restoredUserCounts),
        ...restoredCampaigns.map(c => repository.saveCampaign(c)),
        ...restoredAuditLogs.map(a => repository.saveAuditLog(a)),
      ]);

      // ストア更新
      set({
        histories: restoredHistories,
        userCounts: restoredUserCounts,
        campaigns: restoredCampaigns,
        auditLogs: restoredAuditLogs,
        isLoading: false,
      });

      // 他タブに同期通知
      broadcastSync('BACKUP_RESTORED', { count: restoredHistories.size });

      return {
        success: true,
        message: `復元完了: 履歴 ${restoredHistories.size}件、ユーザー ${restoredUserCounts.size}件、キャンペーン ${restoredCampaigns.length}件、監査ログ ${restoredAuditLogs.length}件`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'JSONのインポートに失敗しました';
      set({
        error: message,
        isLoading: false,
      });
      return { success: false, message };
    }
  },

  // ============================================================================
  // 除外フラグ操作
  // ============================================================================

  /**
   * 除外フラグをトグル
   */
  toggleExcluded: async (reservationId: string) => {
    const { histories } = get();
    const history = histories.get(reservationId);
    if (!history) return;

    const newIsExcluded = !history.isExcluded;
    await get().setExcluded(reservationId, newIsExcluded);
  },

  /**
   * 除外フラグを設定（audit-log記録付き）
   */
  setExcluded: async (reservationId: string, isExcluded: boolean, changedBy = 'user') => {
    const { histories, auditLogs } = get();
    const history = histories.get(reservationId);
    if (!history) return;

    const now = new Date();
    const oldValue = history.isExcluded;

    // 値が変わっていない場合はスキップ
    if (oldValue === isExcluded) return;

    // 監査ログを作成
    const auditLog: AuditLog = {
      id: generateAuditLogId(),
      reservationId,
      field: 'isExcluded',
      oldValue,
      newValue: isExcluded,
      changedAt: now,
      changedBy,
    };

    const updatedHistory: ReservationHistory = {
      ...history,
      isExcluded,
      updatedAt: now,
    };

    // IndexedDBに保存
    const newHistories = new Map(histories);
    newHistories.set(reservationId, updatedHistory);

    try {
      await Promise.all([repository.saveHistoriesBatch(newHistories), repository.saveAuditLog(auditLog)]);
      set({
        histories: newHistories,
        auditLogs: [...auditLogs, auditLog],
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '除外フラグの更新に失敗しました',
      });
    }
  },

  // ============================================================================
  // 手動編集アクション
  // ============================================================================

  /**
   * 予約に担当者を割り当て（汎用版）
   */
  assignStaff: async (reservationId, staffName, changedBy = 'user') => {
    const { histories, auditLogs } = get();
    const history = histories.get(reservationId);
    if (!history) {
      set({ error: '予約が見つかりません' });
      return;
    }

    const now = new Date();
    const oldValue = history.staff;

    // 値が変わっていない場合はスキップ
    if (oldValue === staffName) return;

    // 監査ログを作成
    const auditLog: AuditLog = {
      id: generateAuditLogId(),
      reservationId,
      field: 'staff',
      oldValue,
      newValue: staffName,
      changedAt: now,
      changedBy,
    };

    // 履歴を更新
    const updatedHistory: ReservationHistory = {
      ...history,
      staff: staffName,
      updatedAt: now,
    };

    const newHistories = new Map(histories);
    newHistories.set(reservationId, updatedHistory);

    try {
      await Promise.all([repository.saveHistoriesBatch(newHistories), repository.saveAuditLog(auditLog)]);
      set({
        histories: newHistories,
        auditLogs: [...auditLogs, auditLog],
      });

      // 他タブに同期通知
      broadcastSync('HISTORY_UPDATED', { source: 'assign_staff' });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '担当者の割り当てに失敗しました',
      });
    }
  },

  /**
   * おまかせ予約に担当者を割り当て
   * @deprecated assignStaffを使用してください
   */
  assignStaffToOmakase: async (reservationId, staffName, changedBy = 'user') => {
    // 後方互換性のためassignStaffを呼び出す
    await get().assignStaff(reservationId, staffName, changedBy);
  },

  /**
   * 詳細ステータスを変更
   */
  updateDetailStatus: async (reservationId, detailStatus, changedBy = 'user') => {
    const { histories, auditLogs } = get();
    const history = histories.get(reservationId);
    if (!history) {
      set({ error: '予約が見つかりません' });
      return;
    }

    const now = new Date();
    const oldDetailStatus = history.detailStatus;

    // 実施済みフラグを再計算
    // 前日/当日キャンセルは実施扱い
    const newIsImplemented =
      detailStatus === '前日キャンセル' ||
      detailStatus === '当日キャンセル' ||
      (history.status === '予約済み' && history.visitStatus === '済み');

    // 監査ログを作成
    const auditLog: AuditLog = {
      id: generateAuditLogId(),
      reservationId,
      field: 'detailStatus',
      oldValue: oldDetailStatus,
      newValue: detailStatus,
      changedAt: now,
      changedBy,
    };

    // 履歴を更新
    const updatedHistory: ReservationHistory = {
      ...history,
      detailStatus: detailStatus || null,
      isImplemented: newIsImplemented,
      updatedAt: now,
    };

    const newHistories = new Map(histories);
    newHistories.set(reservationId, updatedHistory);

    try {
      await Promise.all([repository.saveHistoriesBatch(newHistories), repository.saveAuditLog(auditLog)]);
      set({
        histories: newHistories,
        auditLogs: [...auditLogs, auditLog],
      });

      // visitIndexの再計算が必要な場合
      if (newIsImplemented !== history.isImplemented) {
        await get().recalculateVisitIndexes();
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '詳細ステータスの更新に失敗しました',
      });
    }
  },

  /**
   * 実施済み/キャンセルをトグル
   */
  toggleImplementation: async (reservationId, changedBy = 'user') => {
    const { histories, auditLogs } = get();
    const history = histories.get(reservationId);
    if (!history) {
      set({ error: '予約が見つかりません' });
      return;
    }

    const now = new Date();
    const oldIsImplemented = history.isImplemented;
    const newIsImplemented = !oldIsImplemented;

    // ステータスと来店状況も更新
    const newStatus: '予約済み' | 'キャンセル済み' = newIsImplemented ? '予約済み' : 'キャンセル済み';
    const newVisitStatus: '済み' | 'なし' = newIsImplemented ? '済み' : 'なし';

    // 監査ログを作成
    const auditLog: AuditLog = {
      id: generateAuditLogId(),
      reservationId,
      field: 'isImplemented',
      oldValue: oldIsImplemented,
      newValue: newIsImplemented,
      changedAt: now,
      changedBy,
    };

    // 履歴を更新
    const updatedHistory: ReservationHistory = {
      ...history,
      status: newStatus,
      visitStatus: newVisitStatus,
      isImplemented: newIsImplemented,
      detailStatus: newIsImplemented ? null : history.detailStatus,
      updatedAt: now,
    };

    const newHistories = new Map(histories);
    newHistories.set(reservationId, updatedHistory);

    try {
      await Promise.all([repository.saveHistoriesBatch(newHistories), repository.saveAuditLog(auditLog)]);
      set({
        histories: newHistories,
        auditLogs: [...auditLogs, auditLog],
      });

      // visitIndexの再計算
      await get().recalculateVisitIndexes();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '実施状態の切り替えに失敗しました',
      });
    }
  },

  /**
   * 手動で実施/未実施を設定（null=自動判定に戻す）
   */
  setIsImplementedManual: async (reservationId, isImplementedManual, changedBy = 'user') => {
    const { histories, auditLogs } = get();
    const history = histories.get(reservationId);
    if (!history) {
      set({ error: '予約が見つかりません' });
      return;
    }

    const now = new Date();
    const oldValue = history.isImplementedManual;

    // 値が変わっていない場合はスキップ
    if (oldValue === isImplementedManual) return;

    // 監査ログを作成
    const auditLog: AuditLog = {
      id: generateAuditLogId(),
      reservationId,
      field: 'isImplementedManual',
      oldValue,
      newValue: isImplementedManual,
      changedAt: now,
      changedBy,
    };

    // 履歴を更新
    const updatedHistory: ReservationHistory = {
      ...history,
      isImplementedManual,
      updatedAt: now,
    };

    const newHistories = new Map(histories);
    newHistories.set(reservationId, updatedHistory);

    try {
      await Promise.all([repository.saveHistoriesBatch(newHistories), repository.saveAuditLog(auditLog)]);
      set({
        histories: newHistories,
        auditLogs: [...auditLogs, auditLog],
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '実施状態の設定に失敗しました',
      });
    }
  },

  /**
   * 同日の予約を統合（groupId設定）
   */
  mergeReservations: async (reservationIds, primaryReservationId, changedBy = 'user') => {
    const { histories, auditLogs } = get();

    if (reservationIds.length < 2) {
      set({ error: '統合には2件以上の予約が必要です' });
      return;
    }

    if (!reservationIds.includes(primaryReservationId)) {
      set({ error: '主予約が選択された予約に含まれていません' });
      return;
    }

    const primaryHistory = histories.get(primaryReservationId);
    if (!primaryHistory) {
      set({ error: '主予約が見つかりません' });
      return;
    }

    const now = new Date();
    const groupId = generateGroupId(primaryHistory.friendId, primaryHistory.sessionDate);

    const newHistories = new Map(histories);
    const newAuditLogs: AuditLog[] = [];

    for (const reservationId of reservationIds) {
      const history = histories.get(reservationId);
      if (!history) continue;

      // 同じユーザー・同日かチェック
      if (
        history.friendId !== primaryHistory.friendId ||
        formatDate(history.sessionDate) !== formatDate(primaryHistory.sessionDate)
      ) {
        set({ error: '同じユーザーの同日の予約のみ統合できます' });
        return;
      }

      // 監査ログを作成
      const auditLog: AuditLog = {
        id: generateAuditLogId(),
        reservationId,
        field: 'groupId',
        oldValue: history.groupId,
        newValue: groupId,
        changedAt: now,
        changedBy,
      };
      newAuditLogs.push(auditLog);

      // 主予約以外は除外
      const isExcluded = reservationId !== primaryReservationId;

      newHistories.set(reservationId, {
        ...history,
        groupId,
        isExcluded,
        updatedAt: now,
      });
    }

    try {
      await Promise.all([
        repository.saveHistoriesBatch(newHistories),
        ...newAuditLogs.map(log => repository.saveAuditLog(log)),
      ]);
      set({
        histories: newHistories,
        auditLogs: [...auditLogs, ...newAuditLogs],
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '予約の統合に失敗しました',
      });
    }
  },

  /**
   * 予約の統合を解除
   */
  unmergeReservation: async (reservationId, changedBy = 'user') => {
    const { histories, auditLogs } = get();
    const history = histories.get(reservationId);
    if (!history) {
      set({ error: '予約が見つかりません' });
      return;
    }

    if (!history.groupId) {
      set({ error: 'この予約は統合されていません' });
      return;
    }

    const now = new Date();
    const groupId = history.groupId;

    // 同じgroupIdを持つすべての予約を解除
    const newHistories = new Map(histories);
    const newAuditLogs: AuditLog[] = [];

    for (const [id, h] of histories) {
      if (h.groupId === groupId) {
        const auditLog: AuditLog = {
          id: generateAuditLogId(),
          reservationId: id,
          field: 'groupId',
          oldValue: h.groupId,
          newValue: null,
          changedAt: now,
          changedBy,
        };
        newAuditLogs.push(auditLog);

        newHistories.set(id, {
          ...h,
          groupId: null,
          isExcluded: false, // 除外フラグもリセット
          updatedAt: now,
        });
      }
    }

    try {
      await Promise.all([
        repository.saveHistoriesBatch(newHistories),
        ...newAuditLogs.map(log => repository.saveAuditLog(log)),
      ]);
      set({
        histories: newHistories,
        auditLogs: [...auditLogs, ...newAuditLogs],
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '統合の解除に失敗しました',
      });
    }
  },

  /**
   * キャンセル理由メモを更新
   */
  updateCancelReason: async (reservationId, cancelReason, changedBy = 'user') => {
    const { histories, auditLogs } = get();
    const history = histories.get(reservationId);
    if (!history) {
      set({ error: '予約が見つかりません' });
      return;
    }

    const now = new Date();
    const oldValue = history.cancelReason;

    // 値が変わっていない場合はスキップ
    if (oldValue === cancelReason) return;

    // 監査ログを作成
    const auditLog: AuditLog = {
      id: generateAuditLogId(),
      reservationId,
      field: 'cancelReason',
      oldValue,
      newValue: cancelReason,
      changedAt: now,
      changedBy,
    };

    // 履歴を更新
    const updatedHistory: ReservationHistory = {
      ...history,
      cancelReason,
      updatedAt: now,
    };

    const newHistories = new Map(histories);
    newHistories.set(reservationId, updatedHistory);

    try {
      await Promise.all([repository.saveHistoriesBatch(newHistories), repository.saveAuditLog(auditLog)]);
      set({
        histories: newHistories,
        auditLogs: [...auditLogs, auditLog],
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'キャンセル理由の更新に失敗しました',
      });
    }
  },

  /**
   * キャンセル対応ステータスを更新
   */
  updateCancelHandlingStatus: async (reservationId, status, changedBy = 'user') => {
    const { histories, auditLogs } = get();
    const history = histories.get(reservationId);
    if (!history) {
      set({ error: '予約が見つかりません' });
      return;
    }

    const now = new Date();
    const oldValue = history.cancelHandlingStatus;

    // 値が変わっていない場合はスキップ
    if (oldValue === status) return;

    // 監査ログを作成
    const auditLog: AuditLog = {
      id: generateAuditLogId(),
      reservationId,
      field: 'cancelHandlingStatus',
      oldValue,
      newValue: status,
      changedAt: now,
      changedBy,
    };

    // 履歴を更新
    const updatedHistory: ReservationHistory = {
      ...history,
      cancelHandlingStatus: status,
      updatedAt: now,
    };

    const newHistories = new Map(histories);
    newHistories.set(reservationId, updatedHistory);

    try {
      await Promise.all([repository.saveHistoriesBatch(newHistories), repository.saveAuditLog(auditLog)]);
      set({
        histories: newHistories,
        auditLogs: [...auditLogs, auditLog],
      });

      // 他タブに同期通知
      broadcastSync('HISTORY_UPDATED', { source: 'cancel_handling_status' });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'キャンセル対応ステータスの更新に失敗しました',
      });
    }
  },

  // ============================================================================
  // 監査ログ
  // ============================================================================

  /**
   * 監査ログを取得（予約ID指定）
   */
  getAuditLogsByReservation: reservationId => {
    return get()
      .auditLogs.filter(log => log.reservationId === reservationId)
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
  },

  /**
   * 全監査ログを取得（最新順）
   */
  getAllAuditLogs: limit => {
    const logs = get().auditLogs.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
    return limit ? logs.slice(0, limit) : logs;
  },

  /**
   * 監査ログを読み込み
   */
  loadAuditLogs: async () => {
    try {
      const auditLogs = await repository.getAllAuditLogs();
      set({ auditLogs });
    } catch (error) {
      console.error('監査ログの読み込みに失敗:', error);
    }
  },
}));
