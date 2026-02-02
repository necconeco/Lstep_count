/**
 * Domain層 - 公開API
 *
 * このファイルはDomain層の公開インターフェースを定義します。
 * 外部からはこのファイル経由でDomain層の機能にアクセスしてください。
 *
 * 構成:
 * - types.ts: 型定義（統合済み）
 * - logic.ts: ビジネスロジック（新設計）
 * - masterMerge.ts: マスターデータマージロジック
 * - staffMasterData.ts: 担当者マスターデータ
 * - courseMasterData.ts: コースマスターデータ
 */

// ============================================================================
// 型定義のリエクスポート
// ============================================================================
export type {
  // 基本型
  VisitLabel,
  VisitType,
  ReservationStatus,
  VisitStatus,
  CancelTiming,
  TargetDateType,
  ImplementationRule,

  // エンティティ
  ReservationHistory,
  CsvInputRecord,
  UserVisitCount,
  CampaignMaster,
  AuditLog,
  StaffMaster,
  AggregationSnapshot,
  SnapshotFolder,
  SnapshotType,

  // 集計結果
  AggregationSummary,
  DailyAggregation,
  FlatRecord,
  StaffAggregationSummary,
  AggregationRule,

  // マスターデータ
  FullHistoryRecord,
  ImplementationHistoryRecord,
  FullHistoryMaster,
  ImplementationMaster,
  FlattenedRecord,
  MasterDataSummary,
  MasterCsvInputRecord,

  // ストア状態
  HistoryStoreState,
  UserCountStoreState,
  CampaignStoreState,
} from './types';

export {
  // 定数
  CANCEL_TIMING_LABELS,
  DEFAULT_AGGREGATION_RULE,
  IMPLEMENTATION_RULE_LABELS,
} from './types';

// ============================================================================
// ビジネスロジックのリエクスポート（logic.ts）
// ============================================================================
export {
  // 判定関数
  isImplemented,
  shouldCountAsImplemented,
  getCancelTiming,
  getCancelTimingFromStrings,
  getVisitLabel,

  // データ変換
  csvToHistory,
  historyToFlatRecord,
  historiesToFlatRecords,

  // マージ処理
  mergeCsvToHistories,
  recalculateAllVisitIndexes,
  applySameDayMerge,

  // フィルタ
  filterByPeriod,
  filterByCampaign,

  // 集計
  calculateSummary,
  calculateDailyAggregation,

  // エクスポート
  flatRecordsToCSV,

  // ユーティリティ
  formatDate,
  formatDateTime,
  parseLocalDate,
} from './logic';

// ============================================================================
// マスターマージのリエクスポート（masterMerge.ts）
// ============================================================================
export {
  getVisitLabel as getMasterVisitLabel,
  isImplemented as isMasterImplemented,
  csvToFullHistoryRecord,
  mergeFullHistoryRecords,
  recalculateVisitIndex,
  updateFullHistoryMaster,
  updateImplementationMaster,
  batchMergeFullHistoryMasters,
  deriveImplementationMasters,
  flattenFullHistoryMasters,
  getMasterDataSummary,
  flattenedRecordsToCSV,
  formatDate as formatMasterDate,
} from './masterMerge';

// ============================================================================
// 担当者マスターデータ
// ============================================================================
export {
  OFFICIAL_STAFF_MEMBERS,
  OMAKASE_PATTERNS,
  COMMENT_PATTERNS,
  classifyReservationSlot,
  isOfficialStaffMember,
  isOmakaseSlot,
} from './staffMasterData';

// ============================================================================
// コースマスターデータ
// ============================================================================
export {
  OFFICIAL_COURSES,
  isOfficialCourse,
  normalizeCourseNameForMatching,
  getEffectiveCourseName,
} from './courseMasterData';
