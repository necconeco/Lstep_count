/**
 * UIストア - グローバルUI状態管理
 *
 * - ビュー切り替え
 * - 共通フィルタ（基準日・期間）
 * - 実施判定ルール
 */

import { create } from 'zustand';
import type { ImplementationRule } from '../domain/types';

// ============================================================================
// 型定義
// ============================================================================

/**
 * 基準日タイプ
 */
export type DateBaseType = 'application' | 'session';

/**
 * 期間プリセット
 */
export type PeriodPreset = 'thisFiscalYear' | 'thisMonth' | 'lastMonth' | 'all' | 'custom';

/**
 * ビュータイプ
 */
export type ViewType = 'history' | 'monthly' | 'campaign' | 'user';

/**
 * UIストアの状態
 */
export interface UiState {
  // 現在のビュー
  view: ViewType;

  // 共通フィルタ
  dateBaseType: DateBaseType;
  periodPreset: PeriodPreset;
  periodFrom: Date | null;
  periodTo: Date | null;

  // 年度設定（4月始まり）
  fiscalYearStartMonth: number;

  // 実施判定ルール
  implementationRule: ImplementationRule;

  // 同日統合オプション（同じ人が同日に複数予約している場合に1件として扱う）
  mergeSameDayReservations: boolean;

  // アクション
  setView: (view: ViewType) => void;
  setDateBaseType: (type: DateBaseType) => void;
  setPeriodPreset: (preset: PeriodPreset) => void;
  setPeriodRange: (from: Date | null, to: Date | null) => void;
  setImplementationRule: (rule: ImplementationRule) => void;
  setMergeSameDayReservations: (merge: boolean) => void;

  // ヘルパー
  getEffectivePeriod: () => { from: Date | null; to: Date | null };
}

// ============================================================================
// ヘルパー関数
// ============================================================================

/**
 * 今日の日付から所属する年度を取得
 */
function getCurrentFiscalYear(fiscalYearStartMonth: number): number {
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-12
  const currentYear = today.getFullYear();

  // 例: fiscalYearStartMonth = 4 の場合
  // 1-3月 → 前年度（currentYear - 1）
  // 4-12月 → 今年度（currentYear）
  if (currentMonth < fiscalYearStartMonth) {
    return currentYear - 1;
  }
  return currentYear;
}

/**
 * 年度の開始日と終了日を取得
 */
function getFiscalYearRange(
  fiscalYear: number,
  fiscalYearStartMonth: number
): { from: Date; to: Date } {
  // 開始日: fiscalYear年のfiscalYearStartMonth月1日
  const from = new Date(fiscalYear, fiscalYearStartMonth - 1, 1);

  // 終了日: fiscalYear+1年のfiscalYearStartMonth-1月の末日
  const toYear = fiscalYearStartMonth === 1 ? fiscalYear : fiscalYear + 1;
  const toMonth = fiscalYearStartMonth === 1 ? 12 : fiscalYearStartMonth - 1;
  const to = new Date(toYear, toMonth, 0); // 月の末日

  return { from, to };
}

/**
 * 今月の開始日と終了日を取得
 */
function getThisMonthRange(): { from: Date; to: Date } {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0); // 今月の末日
  return { from, to };
}

/**
 * 先月の開始日と終了日を取得
 */
function getLastMonthRange(): { from: Date; to: Date } {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const to = new Date(today.getFullYear(), today.getMonth(), 0); // 先月の末日
  return { from, to };
}

// ============================================================================
// ストア作成
// ============================================================================

export const useUiStore = create<UiState>((set, get) => ({
  // 初期状態
  view: 'history',
  dateBaseType: 'session', // デフォルトは実施日
  periodPreset: 'thisMonth', // デフォルトは今月
  periodFrom: null,
  periodTo: null,
  fiscalYearStartMonth: 4, // 4月始まり
  implementationRule: 'includeLateCancel', // デフォルトは前日・当日キャンセル含む
  mergeSameDayReservations: false, // デフォルトは統合しない

  // アクション
  setView: (view) => set({ view }),

  setDateBaseType: (dateBaseType) => set({ dateBaseType }),

  setPeriodPreset: (periodPreset) => set({ periodPreset }),

  setPeriodRange: (from, to) => set({ periodFrom: from, periodTo: to }),

  setImplementationRule: (implementationRule) => set({ implementationRule }),

  setMergeSameDayReservations: (mergeSameDayReservations) => set({ mergeSameDayReservations }),

  // ヘルパー: 有効な期間を取得
  getEffectivePeriod: () => {
    const { periodPreset, periodFrom, periodTo, fiscalYearStartMonth } = get();

    switch (periodPreset) {
      case 'thisFiscalYear': {
        const fiscalYear = getCurrentFiscalYear(fiscalYearStartMonth);
        return getFiscalYearRange(fiscalYear, fiscalYearStartMonth);
      }
      case 'thisMonth':
        return getThisMonthRange();
      case 'lastMonth':
        return getLastMonthRange();
      case 'custom':
        return { from: periodFrom, to: periodTo };
      case 'all':
      default:
        return { from: null, to: null };
    }
  },
}));

// ============================================================================
// 表示用ヘルパー
// ============================================================================

/**
 * 期間プリセットのラベル
 */
export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  thisFiscalYear: '今年度',
  thisMonth: '今月',
  lastMonth: '先月',
  all: '全期間',
  custom: 'カスタム',
};

/**
 * 基準日タイプのラベル
 */
export const DATE_BASE_TYPE_LABELS: Record<DateBaseType, string> = {
  application: '申込日',
  session: '実施日',
};
