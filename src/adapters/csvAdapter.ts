/**
 * Adapter層 - CSV変換アダプター
 *
 * 責務:
 * - CsvRecord（UI層の型）⇔ CsvInputRecord（Domain層の型）の変換
 * - 日付文字列のパース
 * - データ整形
 *
 * クリーンアーキテクチャにおける位置づけ:
 * - UI/Store層とDomain層の間の橋渡し
 * - 外部形式（CSV）から内部形式への変換
 */

import type { CsvRecord } from '../types';
import type { CsvInputRecord, MasterCsvInputRecord } from '../domain';

// ============================================================================
// 日付パース
// ============================================================================

/**
 * 日付文字列をDateに変換（YYYY-MM-DD形式）
 */
export function parseDate(dateStr: string): Date {
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    console.warn(`[parseDate] Invalid date: ${dateStr}`);
    return new Date();
  }
  return parsed;
}

/**
 * 日時文字列をDateに変換（YYYY-MM-DD HH:mm など）
 */
export function parseDateTime(dateTimeStr: string): Date {
  // 様々な形式に対応
  // "2025-11-20 10:30" or "2025/11/20 10:30" or "2025-11-20T10:30:00"
  const normalized = dateTimeStr.replace(/\//g, '-');
  const parsed = new Date(normalized);
  if (isNaN(parsed.getTime())) {
    console.warn(`[parseDateTime] Invalid datetime: ${dateTimeStr}`);
    return new Date();
  }
  return parsed;
}

// ============================================================================
// CsvRecord → CsvInputRecord 変換
// ============================================================================

/**
 * CsvRecord（UI層）を CsvInputRecord（Domain層）に変換
 */
export function toCsvInputRecord(record: CsvRecord): CsvInputRecord {
  return {
    reservationId: record.予約ID || '',
    friendId: record.友だちID,
    name: record.名前,
    sessionDate: parseDate(record.予約日),
    applicationDate: parseDateTime(record.申込日時),
    status: record.ステータス,
    visitStatus: record['来店/来場'],
    staff: record.担当者 || null,
    detailStatus: record.詳細ステータス || null,
    wasOmakase: record.wasOmakase ?? false,
    course: (record['コース'] as string) || null,
    reservationSlot: (record['予約枠'] as string) || null,
  };
}

/**
 * CsvRecordの配列を CsvInputRecordの配列に一括変換
 */
export function toCsvInputRecords(records: CsvRecord[]): CsvInputRecord[] {
  return records.map(toCsvInputRecord);
}

// ============================================================================
// ID生成
// ============================================================================

/**
 * 監査ログIDを生成
 */
export function generateAuditLogId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * groupIdを生成（friendId_sessionDate形式）
 * @param friendId 友だちID
 * @param sessionDate 予約日
 */
export function generateGroupId(friendId: string, sessionDate: Date): string {
  const year = sessionDate.getFullYear();
  const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
  const day = String(sessionDate.getDate()).padStart(2, '0');
  return `${friendId}_${year}-${month}-${day}`;
}

// ============================================================================
// CsvRecord → MasterCsvInputRecord 変換（マスターマージ用）
// ============================================================================

// MasterCsvInputRecord は上部でインポート済み

/**
 * CsvRecord（UI層）を MasterCsvInputRecord（マスターマージ用）に変換
 */
export function toMasterCsvInputRecord(record: CsvRecord): MasterCsvInputRecord {
  return {
    reservationId: record.予約ID || '',
    friendId: record.友だちID,
    date: parseDate(record.予約日),
    status: record.ステータス,
    visitStatus: record['来店/来場'],
    name: record.名前,
    staff: record.担当者 || null,
    detailStatus: record.詳細ステータス || null,
    applicationDate: record.申込日時,
  };
}

/**
 * CsvRecordの配列を MasterCsvInputRecordの配列に一括変換
 */
export function toMasterCsvInputRecords(records: CsvRecord[]): MasterCsvInputRecord[] {
  return records.map(toMasterCsvInputRecord);
}
