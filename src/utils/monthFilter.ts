/**
 * 月フィルタリングユーティリティ
 * CSVデータから月を抽出し、月でフィルタリングする機能を提供
 */
import type { CsvRecord } from '../types';

/**
 * CSVデータから利用可能な月のリストを抽出
 * @param csvData CSVレコード配列
 * @returns 月のリスト（YYYY-MM形式、降順ソート）
 */
export function extractAvailableMonths(csvData: CsvRecord[]): string[] {
  const monthSet = new Set<string>();

  csvData.forEach((record) => {
    // 予約日から月を抽出（YYYY-MM-DD → YYYY-MM）
    const reservationDate = record.予約日;
    if (reservationDate && typeof reservationDate === 'string') {
      const month = reservationDate.substring(0, 7); // YYYY-MM部分を抽出
      if (month.match(/^\d{4}-\d{2}$/)) {
        // YYYY-MM形式の妥当性チェック
        monthSet.add(month);
      }
    }
  });

  // 配列に変換して降順ソート（最新月が先頭）
  return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
}

/**
 * 指定された月のデータのみをフィルタリング
 * @param csvData CSVレコード配列
 * @param targetMonth 対象月（YYYY-MM形式）、nullの場合は全データを返す
 * @returns フィルタリングされたCSVレコード配列
 */
export function filterDataByMonth(
  csvData: CsvRecord[],
  targetMonth: string | null
): CsvRecord[] {
  // targetMonthがnullの場合は全データを返す
  if (!targetMonth) {
    return csvData;
  }

  // 指定された月のデータのみをフィルタ
  return csvData.filter((record) => {
    const reservationDate = record.予約日;
    if (reservationDate && typeof reservationDate === 'string') {
      const month = reservationDate.substring(0, 7); // YYYY-MM部分を抽出
      return month === targetMonth;
    }
    return false;
  });
}

/**
 * 最新の月を取得
 * @param months 月のリスト（YYYY-MM形式）
 * @returns 最新の月、リストが空の場合はnull
 */
export function getLatestMonth(months: string[]): string | null {
  if (months.length === 0) {
    return null;
  }
  // 降順ソート済みの前提で、最初の要素が最新月
  return months[0] || null;
}
