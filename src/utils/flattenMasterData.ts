/**
 * マスターデータフラット化ユーティリティ
 * UserHistoryMaster の implementationHistory を予約1件=1行にフラット化
 */

import type { UserHistoryMaster, ImplementationRecord, VisitType } from '../types';
import { parseLocalDate } from '../domain';

/**
 * 日付をローカルタイムゾーンで復元
 * Date オブジェクトまたは文字列から、日付部分のみを取得してローカル時間として解釈
 */
function restoreDateOnly(dateValue: Date | string): Date {
  if (dateValue instanceof Date) {
    // すでにDateの場合、ISOStringから日付部分を取得してローカルで再解釈
    const str = dateValue.toISOString();
    const datePart = str.split('T')[0];
    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return parseLocalDate(datePart);
    }
    return dateValue;
  }
  // 文字列の場合
  const datePart = String(dateValue).split('T')[0];
  if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return parseLocalDate(datePart);
  }
  return new Date(dateValue);
}

/**
 * フラット化された履歴レコード
 */
export interface FlattenedHistoryRecord {
  friendId: string; // 友だちID
  reservationId: string; // 予約ID
  date: Date; // 実施日
  dateString: string; // 実施日（YYYY-MM-DD形式）
  visitIndex: number; // 来店回数（1, 2, 3, ...）
  visitLabel: VisitType; // 来店ラベル（初回, 2回目, 3回目以降）
  staff: string | null; // 担当者名
  createdAt: Date; // マスターレコード作成日
  updatedAt: Date; // マスターレコード更新日
}

/**
 * 来店回数から VisitType ラベルを取得
 */
export function getVisitLabel(visitIndex: number): VisitType {
  if (visitIndex === 1) return '初回';
  if (visitIndex === 2) return '2回目';
  return '3回目以降';
}

/**
 * マスターデータをフラット化して履歴一覧を生成
 *
 * @param masterData - Map<friendId, UserHistoryMaster>
 * @returns FlattenedHistoryRecord[] - 日付順にソートされた履歴一覧
 */
export function flattenMasterData(masterData: Map<string, UserHistoryMaster>): FlattenedHistoryRecord[] {
  const flattenedRecords: FlattenedHistoryRecord[] = [];

  masterData.forEach((master, friendId) => {
    // implementationHistory を日付順にソート（古い順）
    const sortedHistory = [...(master.implementationHistory || [])].sort(
      (a, b) => restoreDateOnly(a.date).getTime() - restoreDateOnly(b.date).getTime()
    );

    // 各履歴レコードにインデックスとラベルを付与
    sortedHistory.forEach((record: ImplementationRecord, index: number) => {
      const visitIndex = index + 1; // 1-based index
      const date = restoreDateOnly(record.date);

      flattenedRecords.push({
        friendId,
        reservationId: record.reservationId,
        date,
        dateString: formatDate(date),
        visitIndex,
        visitLabel: getVisitLabel(visitIndex),
        staff: record.staff || null,
        createdAt: master.createdAt instanceof Date ? master.createdAt : new Date(master.createdAt),
        updatedAt: master.updatedAt instanceof Date ? master.updatedAt : new Date(master.updatedAt),
      });
    });
  });

  // 日付の新しい順（降順）でソート
  flattenedRecords.sort((a, b) => b.date.getTime() - a.date.getTime());

  return flattenedRecords;
}

/**
 * 日付を YYYY-MM-DD 形式にフォーマット
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * フラット化された履歴データをCSV形式に変換
 *
 * @param records - FlattenedHistoryRecord[]
 * @returns CSV文字列
 */
export function flattenedHistoryToCSV(records: FlattenedHistoryRecord[]): string {
  // CSVヘッダー
  const header = ['友だちID', '予約ID', '実施日', '来店回数', '区分', '担当者'].join(',');

  // CSVボディ
  const rows = records.map(record => {
    return [
      escapeCSVValue(record.friendId),
      escapeCSVValue(record.reservationId),
      record.dateString,
      record.visitIndex.toString(),
      record.visitLabel,
      escapeCSVValue(record.staff || ''),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * CSV値のエスケープ処理
 */
function escapeCSVValue(value: string): string {
  if (!value) return '';

  // CSVインジェクション対策: 数式開始文字で始まる場合はシングルクォートでプレフィックス
  const DANGEROUS_CHARS = /^[=+\-@\t\r]/;
  let sanitized = value;

  if (DANGEROUS_CHARS.test(value)) {
    sanitized = "'" + value;
  }

  // カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
  if (sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('"')) {
    sanitized = `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}

/**
 * 統計サマリーを生成
 */
export interface FlattenedHistorySummary {
  totalUsers: number; // ユニークユーザー数
  totalRecords: number; // 総履歴件数
  firstTimeCount: number; // 初回の件数
  repeatCount: number; // 2回目以降の件数
}

export function getFlattenedHistorySummary(
  masterData: Map<string, UserHistoryMaster>,
  records: FlattenedHistoryRecord[]
): FlattenedHistorySummary {
  const firstTimeCount = records.filter(r => r.visitIndex === 1).length;
  const repeatCount = records.filter(r => r.visitIndex > 1).length;

  return {
    totalUsers: masterData.size,
    totalRecords: records.length,
    firstTimeCount,
    repeatCount,
  };
}
