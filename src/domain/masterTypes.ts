/**
 * Domain層 - マスターデータ型定義
 * 2系統マスター: 実施マスター / フル履歴マスター
 */

import type { VisitType } from '../types';

// ============================================================================
// 共通型
// ============================================================================

/**
 * 予約履歴の1レコード（フル履歴用）
 */
export interface FullHistoryRecord {
  reservationId: string; // 予約ID（主キー）
  friendId: string; // 友だちID
  date: Date; // 予約日
  status: '予約済み' | 'キャンセル済み';
  visitStatus: '済み' | 'なし'; // 来店/来場ステータス
  isImplemented: boolean; // 実施済みフラグ
  name: string; // 名前
  staff: string | null; // 担当者名
  detailStatus: string | null; // 詳細ステータス（前日キャンセル等）
  applicationDate: string; // 申込日時（元CSV）
  visitIndex: number; // 来店回数（1, 2, 3, ...）この友だちの何回目の実施か
  visitLabel: VisitType; // 来店ラベル（初回, 2回目, 3回目以降）
  // 重複判定用フォールバックキー
  fallbackKey: string; // friendId + date + (予約時刻など)
}

/**
 * 実施履歴の1レコード（実施マスター用）
 */
export interface ImplementationHistoryRecord {
  reservationId: string; // 予約ID
  friendId: string; // 友だちID
  date: Date; // 実施日
  staff: string | null; // 担当者名
  visitIndex: number; // 来店回数（1, 2, 3, ...）
  visitLabel: VisitType; // 来店ラベル
}

// ============================================================================
// マスターデータ型
// ============================================================================

/**
 * フル履歴マスター（友だちID単位）
 * CSVの全行（キャンセル含む）を保持
 */
export interface FullHistoryMaster {
  friendId: string; // 主キー
  records: FullHistoryRecord[]; // 全履歴（日付順）
  totalRecordCount: number; // 総レコード数
  implementationCount: number; // 実施回数
  lastImplementationDate: Date | null; // 最終実施日
  lastStaff: string | null; // 最終担当者
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 実施マスター（友だちID単位）
 * 実施行のみ保持（visitIndex計算用）
 */
export interface ImplementationMaster {
  friendId: string; // 主キー
  records: ImplementationHistoryRecord[]; // 実施履歴のみ（日付順）
  implementationCount: number; // 実施回数
  lastImplementationDate: Date | null; // 最終実施日
  lastStaff: string | null; // 最終担当者
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CSV入力型（パース後）
// ============================================================================

/**
 * CSV入力レコード（マージ処理用）
 */
export interface CsvInputRecord {
  reservationId: string;
  friendId: string;
  date: Date;
  status: '予約済み' | 'キャンセル済み';
  visitStatus: '済み' | 'なし';
  name: string;
  staff: string | null;
  detailStatus: string | null;
  applicationDate: string;
}

// ============================================================================
// 出力型（フラット化）
// ============================================================================

/**
 * フラット化された履歴レコード（CSV出力・テーブル表示用）
 */
export interface FlattenedRecord {
  reservationId: string;
  friendId: string;
  date: Date;
  dateString: string; // YYYY-MM-DD形式
  status: '予約済み' | 'キャンセル済み';
  visitStatus: '済み' | 'なし';
  isImplemented: boolean;
  name: string;
  staff: string | null;
  detailStatus: string | null;
  visitIndex: number; // 実施の場合のみ有効（0=未実施/キャンセル）
  visitLabel: VisitType | '-'; // 実施の場合のみ有効
}

/**
 * マスターデータ統計サマリー
 */
export interface MasterDataSummary {
  totalUsers: number; // ユニークユーザー数
  totalRecords: number; // 総履歴件数
  implementationCount: number; // 実施件数
  cancellationCount: number; // キャンセル件数
  pendingCount: number; // 予約中件数
  firstTimeCount: number; // 初回実施件数
  repeatCount: number; // 2回目以降実施件数
}
