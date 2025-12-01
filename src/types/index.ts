/**
 * Lステップ集計ツール - 型定義
 * Version: 2.1（実CSV構造対応版）
 */

// ============================================================================
// CSV関連の型
// ============================================================================

/**
 * CSVレコード型（実際のLステップCSV出力）
 */
export interface CsvRecord {
  予約ID: string;
  友だちID: string; // 必須: マスタデータのキー
  予約日: string; // 必須: 集計キー（YYYY-MM-DD形式）
  ステータス: '予約済み' | 'キャンセル済み'; // 実際のCSVは2種類のみ
  '来店/来場': '済み' | 'なし'; // 実施判定の重要フィールド
  名前: string; // 必須: 表示用
  申込日時: string; // 必須
  メモ?: string; // オプション
  担当者?: string; // オプション（相談員名）
  [key: string]: string | undefined; // その他のフィールド
}

/**
 * 実施判定結果
 */
export type ImplementationStatus = '実施済み' | '予約中' | 'キャンセル済み';

/**
 * 初回/2回目判定結果
 */
export type VisitType = '初回' | '2回目' | '3回目以降';

// ============================================================================
// 履歴マスタデータ関連
// ============================================================================

/**
 * ユーザー履歴マスタ（IndexedDB保存）
 */
export interface UserHistoryMaster {
  friendId: string; // 主キー: 友だちID
  implementationCount: number; // 実施回数
  lastImplementationDate: Date | null; // 最終実施日
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 集計結果関連
// ============================================================================

/**
 * サマリー集計結果
 */
export interface AggregationSummary {
  // 全体集計
  totalApplications: number; // 申込数（全レコード数）
  totalImplementations: number; // 実施数
  totalCancellations: number; // キャンセル数
  implementationRate: number; // 実施率(%)

  // 初回集計
  firstTimeApplications: number; // 初回申込数
  firstTimeApplicationRate: number; // 初回申込率(%)
  firstTimeImplementations: number; // 初回実施数
  firstTimeImplementationRate: number; // 初回実施率(%)

  // 2回目以降集計
  repeatApplications: number; // 2回目以降申込数
  repeatApplicationRate: number; // 2回目以降申込率(%)
  repeatImplementations: number; // 2回目以降実施数
  repeatImplementationRate: number; // 2回目以降実施率(%)
}

/**
 * 相談員別実績
 */
export interface StaffResult {
  staffName: string; // 相談員名
  applications: number; // 申込数
  implementations: number; // 実施数
  cancellations: number; // キャンセル数
  implementationRate: number; // 実施率(%)
  firstTimeCount: number; // 初回数
  repeatCount: number; // 2回目以降数
}

/**
 * 日別集計
 */
export interface DailyResult {
  date: string; // 日付（YYYY-MM-DD）
  applications: number; // 申込数
  implementations: number; // 実施数
  cancellations: number; // キャンセル数
  firstTimeCount: number; // 初回数
  repeatCount: number; // 2回目以降数
}

/**
 * 月別集計
 */
export interface MonthlyResult {
  month: string; // 月（YYYY-MM）
  applications: number; // 申込数
  implementations: number; // 実施数
  cancellations: number; // キャンセル数
  implementationRate: number; // 実施率(%)
}

// ============================================================================
// 要確認リスト関連
// ============================================================================

/**
 * 要確認パターン種別
 */
export type ReviewPattern = 'pattern1' | 'pattern2' | 'pattern3';

/**
 * 要確認レコード
 */
export interface ReviewRecord {
  pattern: ReviewPattern;
  patternName: string; // パターン名（表示用）
  record: CsvRecord; // 元のCSVレコード
  reason: string; // 確認理由
}

// ============================================================================
// キャンセル関連
// ============================================================================

/**
 * キャンセルレコード
 */
export interface CancellationRecord {
  record: CsvRecord;
  visitType: VisitType; // 初回/2回目
  cancellationDate: string; // キャンセル日
}

// ============================================================================
// スプレッドシート出力関連
// ============================================================================

/**
 * スプレッドシート出力データ（AB~AM列）
 */
export interface SpreadsheetOutputData {
  AB: number; // 初回予約合計
  AC: number; // 初回予約率(%)
  AD: number; // 初回実施合計
  AE: number; // 初回実施率(%)
  AJ: number; // 2回目以降予約合計
  AK: number; // 2回目以降予約率(%)
  AL: number; // 2回目以降実施合計
  AM: number; // 2回目以降実施率(%)
}

// ============================================================================
// 集計履歴関連
// ============================================================================

/**
 * 集計履歴（IndexedDB保存）
 */
export interface AggregationHistory {
  id: string; // 集計ID（YYYYMM形式）
  month: string; // 集計月（YYYY-MM）
  summary: AggregationSummary;
  staffResults: StaffResult[];
  dailyResults: DailyResult[];
  monthlyResults: MonthlyResult[];
  spreadsheetData: SpreadsheetOutputData;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Zustand Store関連
// ============================================================================

/**
 * CSVストアの状態
 */
export interface CsvStoreState {
  csvData: CsvRecord[];
  isLoading: boolean;
  error: string | null;
  fileName: string | null;
  uploadedAt: Date | null;

  setCsvData: (data: CsvRecord[], fileName: string) => void;
  clearCsvData: () => void;
  setError: (error: string | null) => void;
  setLoading: (isLoading: boolean) => void;
}

/**
 * 履歴マスタストアの状態
 */
export interface MasterStoreState {
  masterData: Map<string, UserHistoryMaster>;
  isLoading: boolean;
  error: string | null;

  loadMasterData: () => Promise<void>;
  updateMasterData: (friendId: string, implementationDate: Date) => Promise<void>;
  getMasterRecord: (friendId: string) => UserHistoryMaster | null;
  clearMasterData: () => Promise<void>;
}

/**
 * 集計結果ストアの状態
 */
export interface AggregationStoreState {
  summary: AggregationSummary | null;
  staffResults: StaffResult[];
  dailyResults: DailyResult[];
  monthlyResults: MonthlyResult[];
  spreadsheetData: SpreadsheetOutputData | null;
  isProcessing: boolean;
  error: string | null;

  processData: (csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>) => Promise<void>;
  clearResults: () => void;
  setError: (error: string | null) => void;
}

/**
 * 要確認リストストアの状態
 */
export interface ReviewStoreState {
  reviewRecords: ReviewRecord[];
  cancellationRecords: CancellationRecord[];
  isProcessing: boolean;
  error: string | null;

  detectReviewRecords: (csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>) => void;
  clearReviewRecords: () => void;
  setError: (error: string | null) => void;
}

// ============================================================================
// ユーティリティ関数の戻り値型
// ============================================================================

/**
 * CSV解析結果
 */
export interface ParseResult {
  success: boolean;
  data: CsvRecord[];
  errors: string[];
  warnings: string[];
}

/**
 * 実施判定結果（詳細）
 */
export interface ImplementationCheck {
  status: ImplementationStatus;
  isImplemented: boolean;
  visitType: VisitType;
  implementationCount: number;
}
