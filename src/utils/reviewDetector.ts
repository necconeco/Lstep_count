/**
 * 要確認リスト検出ロジック
 */
import type { CsvRecord, UserHistoryMaster, ReviewRecord, CancellationRecord, VisitType } from '../types';
import { getVisitType } from './dataAggregator';

/**
 * パターン1: データ不整合
 * ステータス「キャンセル済み」だが来店/来場が「済み」
 */
export function detectPattern1(csvData: CsvRecord[]): ReviewRecord[] {
  return csvData
    .filter((record) => record.ステータス === 'キャンセル済み' && record['来店/来場'] === '済み')
    .map((record) => ({
      pattern: 'pattern1' as const,
      patternName: 'パターン1: データ不整合',
      record,
      reason: 'ステータスが「キャンセル済み」ですが、来店/来場が「済み」になっています。データの不整合の可能性があります。',
    }));
}

/**
 * パターン2: 未来日予約
 * ステータス「予約済み」だが来店/来場が「なし」
 */
export function detectPattern2(csvData: CsvRecord[]): ReviewRecord[] {
  return csvData
    .filter((record) => record.ステータス === '予約済み' && record['来店/来場'] === 'なし')
    .map((record) => ({
      pattern: 'pattern2' as const,
      patternName: 'パターン2: 未来日予約',
      record,
      reason: 'ステータスが「予約済み」ですが、来店/来場が「なし」です。実施記録の入力漏れの可能性があります。',
    }));
}

/**
 * パターン3: 通常キャンセル
 * ステータス「キャンセル済み」で来店/来場が「なし」
 */
export function detectPattern3(csvData: CsvRecord[]): ReviewRecord[] {
  return csvData
    .filter((record) => record.ステータス === 'キャンセル済み' && record['来店/来場'] === 'なし')
    .map((record) => ({
      pattern: 'pattern3' as const,
      patternName: 'パターン3: 通常キャンセル',
      record,
      reason: 'ステータスが「キャンセル済み」で来店/来場が「なし」です。通常のキャンセルです。',
    }));
}

/**
 * 全パターンの要確認レコードを検出
 */
export function detectAllReviewRecords(csvData: CsvRecord[]): ReviewRecord[] {
  const pattern1 = detectPattern1(csvData);
  const pattern2 = detectPattern2(csvData);
  const pattern3 = detectPattern3(csvData);

  return [...pattern1, ...pattern2, ...pattern3];
}

/**
 * キャンセル一覧を生成
 */
export function generateCancellationList(
  csvData: CsvRecord[],
  masterData: Map<string, UserHistoryMaster>
): CancellationRecord[] {
  return csvData
    .filter((record) => record.ステータス === 'キャンセル済み')
    .map((record) => {
      const visitType: VisitType = getVisitType(record.友だちID, masterData);

      return {
        record,
        visitType,
        cancellationDate: record.予約日, // 実際のキャンセル日がない場合は予約日を使用
      };
    });
}

/**
 * 要確認レコード数の統計
 */
export function getReviewStatistics(reviewRecords: ReviewRecord[]): {
  pattern1Count: number;
  pattern2Count: number;
  pattern3Count: number;
  totalCount: number;
} {
  const pattern1Count = reviewRecords.filter((r) => r.pattern === 'pattern1').length;
  const pattern2Count = reviewRecords.filter((r) => r.pattern === 'pattern2').length;
  const pattern3Count = reviewRecords.filter((r) => r.pattern === 'pattern3').length;

  return {
    pattern1Count,
    pattern2Count,
    pattern3Count,
    totalCount: reviewRecords.length,
  };
}
