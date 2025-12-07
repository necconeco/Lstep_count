/**
 * Domain層 - 新設計の型定義
 *
 * ストア構成:
 * 1. reservation-history: CSVの生データ蓄積（事実）
 * 2. user-visit-count: 初回/2回目判定用カウンター（サマリ）
 * 3. campaign-master: キャンペーン定義（ルール）
 * 4. audit-log: 手動変更の履歴（変更追跡）
 * 5. staff-master: 担当者マスター（ハイブリッド方式）
 * 6. aggregation-snapshot: 確定集計結果の保存
 * 7. snapshot-folder: スナップショットのフォルダ管理
 */

// ============================================================================
// 共通型
// ============================================================================

/**
 * 来店タイプ
 */
export type VisitLabel = '初回' | '2回目' | '3回目以降';

/**
 * 予約ステータス
 */
export type ReservationStatus = '予約済み' | 'キャンセル済み';

/**
 * 来店/来場ステータス
 */
export type VisitStatus = '済み' | 'なし';

/**
 * キャンセルタイミング
 * - same-day: 当日キャンセル（実施日 = 申込日）
 * - previous-day: 前日キャンセル（実施日 - 申込日 = 1日）
 * - early: 早期キャンセル（実施日 - 申込日 >= 2日）
 * - none: キャンセルではない
 */
export type CancelTiming = 'same-day' | 'previous-day' | 'early' | 'none';

/**
 * キャンセルタイミングのラベル
 */
export const CANCEL_TIMING_LABELS: Record<CancelTiming, string> = {
  'same-day': '当日キャンセル',
  'previous-day': '前日キャンセル',
  early: 'キャンセル',
  none: '',
};

/**
 * 日付タイプ（キャンペーン集計用）
 */
export type TargetDateType = 'application' | 'session';

// ============================================================================
// ① 履歴ストア（reservation-history）
// ============================================================================

/**
 * 予約履歴レコード
 * CSVの1行 = 1レコードとして蓄積
 */
export interface ReservationHistory {
  // 主キー
  reservationId: string;

  // 基本情報
  friendId: string;
  name: string;

  // 日付（2種類）
  sessionDate: Date; // 実施日（CSVの「予約日」）
  applicationDate: Date; // 申込日時

  // ステータス
  status: ReservationStatus;
  visitStatus: VisitStatus;
  isImplemented: boolean; // 実施済みフラグ（計算済み）

  // オプション情報
  staff: string | null;
  detailStatus: string | null; // 前日キャンセル・当日キャンセル等
  course: string | null; // コース名
  reservationSlot: string | null; // 予約枠（G列の元データ）

  // 計算済みフィールド（キャッシュ）
  visitIndex: number | null; // この人の何回目か（実施時のみ、未実施はnull）
  visitLabel: VisitLabel | null; // 初回/2回目/3回目以降（未実施はnull）

  // 手動オーバーライド
  isExcluded: boolean; // 集計から除外するかどうか（デフォルト: false）
  isImplementedManual: boolean | null; // 手動で実施/未実施を上書き（null=自動判定）

  // 追加フィールド（手動調整・統合機能用）
  wasOmakase: boolean; // CSVで担当者が「おまかせ」だった
  groupId: string | null; // 同日複数申込の統合ID（形式: friendId_YYYY-MM-DD）

  // メタ情報
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CSVからの入力レコード（パース後）
 */
export interface CsvInputRecord {
  reservationId: string;
  friendId: string;
  name: string;
  sessionDate: Date; // 予約日
  applicationDate: Date; // 申込日時
  status: ReservationStatus;
  visitStatus: VisitStatus;
  staff: string | null;
  detailStatus: string | null;
  wasOmakase: boolean; // おまかせ予約だったか
  course: string | null; // コース名
  reservationSlot: string | null; // 予約枠（G列の元データ）
}

// ============================================================================
// ② ユーザー来店カウント（user-visit-count）
// ============================================================================

/**
 * ユーザーごとの来店カウント
 * 初回/2回目判定の「真実のカウンター」
 */
export interface UserVisitCount {
  // 主キー
  friendId: string;

  // カウント情報
  implementationCount: number; // 実施回数（累計）
  lastSessionDate: Date | null; // 最終実施日

  // メタ情報
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// ③ キャンペーン定義（campaign-master）
// ============================================================================

/**
 * キャンペーン定義
 * 集計時の「ルール」を定義
 */
export interface CampaignMaster {
  // 主キー
  campaignId: string;

  // 基本情報
  campaignName: string; // 例: "キャリア相談11月"
  description?: string; // 説明（オプション）

  // 対象期間
  targetPeriodFrom: Date;
  targetPeriodTo: Date;

  // 日付タイプ（どの日付で期間判定するか）
  targetDateType: TargetDateType;

  // オプション
  fiscalYear?: number; // 年度

  // メタ情報
  isActive: boolean; // 有効/無効
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 集計結果型
// ============================================================================

/**
 * 実施判定ルール
 * - strict: 来店実施のみカウント
 * - includeLateCancel: 来店実施 + 前日/当日キャンセルもカウント
 */
export type ImplementationRule = 'strict' | 'includeLateCancel';

/**
 * 集計ルール（リアルタイム適用）
 */
export interface AggregationRule {
  // 実施判定ルール
  implementationRule: ImplementationRule;
  // NoShow（予約済み・来店なし）を除外する
  excludeNoShow: boolean;
}

/**
 * デフォルトの集計ルール
 */
export const DEFAULT_AGGREGATION_RULE: AggregationRule = {
  implementationRule: 'includeLateCancel', // デフォルトは前日/当日キャンセルも含む
  excludeNoShow: false,
};

/**
 * 実施判定ルールのラベル
 */
export const IMPLEMENTATION_RULE_LABELS: Record<ImplementationRule, string> = {
  strict: '純粋な実施のみ',
  includeLateCancel: '前日・当日キャンセル含む',
};

/**
 * 集計サマリー
 */
export interface AggregationSummary {
  // 期間情報
  periodFrom: Date;
  periodTo: Date;
  dateType: TargetDateType;

  // 全体集計
  totalRecords: number; // 総レコード数
  totalImplementations: number; // 実施数
  totalCancellations: number; // キャンセル数
  implementationRate: number; // 実施率(%)

  // 初回/2回目内訳
  firstTimeCount: number; // 初回数
  repeatCount: number; // 2回目以降数
  firstTimeRate: number; // 初回率(%)
}

/**
 * 日別集計
 */
export interface DailyAggregation {
  date: string; // YYYY-MM-DD
  totalRecords: number;
  implementations: number;
  cancellations: number;
  firstTimeCount: number;
  repeatCount: number;
}

// ============================================================================
// フラット表示用（UI・CSV出力）
// ============================================================================

/**
 * 表示用フラットレコード
 */
export interface FlatRecord {
  reservationId: string;
  friendId: string;
  name: string;
  sessionDateStr: string; // YYYY-MM-DD形式
  applicationDateStr: string; // YYYY-MM-DD HH:mm形式
  status: ReservationStatus;
  visitStatus: VisitStatus;
  isImplemented: boolean;
  staff: string | null;
  detailStatus: string | null;
  visitIndex: number | null;
  visitLabel: VisitLabel | '-' | null;
  isExcluded: boolean; // 集計から除外するかどうか
  wasOmakase: boolean; // おまかせ予約だったか（担当者手動割当用）
  course: string | null; // コース名
  reservationSlot: string | null; // 予約枠（G列の元データ）
}

// ============================================================================
// ストア状態型
// ============================================================================

/**
 * 履歴ストアの状態
 */
export interface HistoryStoreState {
  histories: Map<string, ReservationHistory>;
  isLoading: boolean;
  error: string | null;
}

/**
 * ユーザーカウントストアの状態
 */
export interface UserCountStoreState {
  userCounts: Map<string, UserVisitCount>;
  isLoading: boolean;
  error: string | null;
}

/**
 * キャンペーンストアの状態
 */
export interface CampaignStoreState {
  campaigns: CampaignMaster[];
  selectedCampaignId: string | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// ④ 監査ログ（audit-log）
// ============================================================================

/**
 * 監査ログ - 手動変更の履歴を記録
 */
export interface AuditLog {
  // 主キー
  id: string; // UUID

  // 対象情報
  reservationId: string; // 対象の予約ID

  // 変更内容
  field: string; // 変更フィールド名（staff / isCancelled / isImplemented / groupId 等）
  oldValue: unknown; // 変更前の値
  newValue: unknown; // 変更後の値

  // メタ情報
  changedAt: Date; // 変更日時
  changedBy: string; // 変更者（当面 'goma'）
}

// ============================================================================
// ⑤ 担当者マスター（staff-master）
// ============================================================================

/**
 * 担当者マスター - ハイブリッド方式
 * CSVから自動抽出 → 手動で追加/削除/統合
 */
export interface StaffMaster {
  // 主キー
  staffId: string; // UUID

  // 基本情報
  staffName: string; // 表示名（正規化後）
  aliases: string[]; // 表記揺れ一覧（CSVで検出された名前）

  // 状態
  isActive: boolean; // 有効/無効
  sortOrder: number; // 表示順

  // メタ情報
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// ⑥ 集計スナップショット（aggregation-snapshot）
// ============================================================================

/**
 * スナップショットタイプ
 */
export type SnapshotType = 'monthly' | 'campaign' | 'staff';

/**
 * 集計スナップショット - 確定した集計結果を保存
 */
export interface AggregationSnapshot {
  // 主キー
  id: string; // UUID

  // 基本情報
  type: SnapshotType; // 集計タイプ
  label: string; // 表示名（例: "2025-11 月次（実施日）"）

  // 集計条件
  dateBaseType: TargetDateType; // 基準日タイプ
  periodFrom: Date; // 期間開始
  periodTo: Date; // 期間終了
  campaignId?: string; // キャンペーン集計の場合のみ

  // 集計結果
  payload: unknown; // 集計結果JSON

  // 管理機能
  folderName: string | null; // フォルダ/カテゴリー名（null = ルート）
  isPinned: boolean; // ピン留め（お気に入り）

  // メタ情報
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

// ============================================================================
// ⑦ スナップショットフォルダ（snapshot-folder）
// ============================================================================

/**
 * スナップショットフォルダ - カテゴリー管理用
 */
export interface SnapshotFolder {
  // 主キー
  folderId: string; // UUID

  // 基本情報
  folderName: string; // フォルダ名

  // 表示設定
  sortOrder: number; // 表示順

  // メタ情報
  createdAt: Date;
}

// ============================================================================
// 担当者別集計結果型
// ============================================================================

/**
 * 担当者別集計サマリー
 */
export interface StaffAggregationSummary {
  staffName: string; // 担当者名
  totalCount: number; // 総件数
  implementedCount: number; // 実施件数
  cancelCount: number; // キャンセル件数
  firstVisitCount: number; // 初回
  secondVisitCount: number; // 2回目
  thirdOrMoreCount: number; // 3回目以降
  omakaseAssignedCount: number; // おまかせからの配分件数
  uniqueUsers: number; // ユニークユーザー数
  groupedCount: number; // groupIdでまとめた件数
}
