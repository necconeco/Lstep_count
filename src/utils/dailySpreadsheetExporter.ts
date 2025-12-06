/**
 * 日別集計データをスプレッドシート形式でCSV出力
 * スプレッドシートのAB〜AM列に対応
 */
import type { CsvRecord, UserHistoryMaster } from '../types';
import { getVisitType, isImplemented } from './dataAggregator';

export interface DailySpreadsheetRow {
  date: string; // 日付
  firstTimeReservations: number; // 初回キャリア相談予約【合計】
  firstTimeReservationRate: number; // 初回キャリア相談予約【初回予約率】
  firstTimeImplementations: number; // 初回キャリア相談実施【合計】
  firstTimeImplementationRate: number; // 初回キャリア相談実施【初回実施率】
  repeatReservations: number; // 2回目以降予約【件数】
  repeatReservationRate: number; // 2回目以降予約【予約率】
  repeatImplementations: number; // 2回目以降実施【件数】
  repeatImplementationRate: number; // 2回目以降実施【実施率】
}

/**
 * 日別集計データを生成
 */
export function generateDailySpreadsheetData(
  csvData: CsvRecord[],
  masterData: Map<string, UserHistoryMaster>
): DailySpreadsheetRow[] {
  const dailyMap = new Map<string, DailySpreadsheetRow>();

  // 各レコードを日付ごとに集計
  csvData.forEach((record) => {
    const date = record.予約日;
    const visitType = getVisitType(record.友だちID, masterData);
    const implemented = isImplemented(record);

    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        firstTimeReservations: 0,
        firstTimeReservationRate: 0,
        firstTimeImplementations: 0,
        firstTimeImplementationRate: 0,
        repeatReservations: 0,
        repeatReservationRate: 0,
        repeatImplementations: 0,
        repeatImplementationRate: 0,
      });
    }

    const daily = dailyMap.get(date)!;

    // 初回 vs 2回目以降
    if (visitType === '初回') {
      daily.firstTimeReservations++;
      if (implemented) {
        daily.firstTimeImplementations++;
      }
    } else {
      // 2回目以降（2回目 + 3回目以降）
      daily.repeatReservations++;
      if (implemented) {
        daily.repeatImplementations++;
      }
    }
  });

  // 各日の割合を計算
  const dailyResults = Array.from(dailyMap.values()).map((daily) => {
    const totalReservations = daily.firstTimeReservations + daily.repeatReservations;

    return {
      ...daily,
      firstTimeReservationRate:
        totalReservations > 0 ? (daily.firstTimeReservations / totalReservations) * 100 : 0,
      firstTimeImplementationRate:
        daily.firstTimeReservations > 0
          ? (daily.firstTimeImplementations / daily.firstTimeReservations) * 100
          : 0,
      repeatReservationRate:
        totalReservations > 0 ? (daily.repeatReservations / totalReservations) * 100 : 0,
      repeatImplementationRate:
        daily.repeatReservations > 0
          ? (daily.repeatImplementations / daily.repeatReservations) * 100
          : 0,
    };
  });

  // 日付順（昇順）にソート
  return dailyResults.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * TTL（合計）行を生成
 */
function generateTTLRow(dailyData: DailySpreadsheetRow[]): DailySpreadsheetRow {
  const totalFirstTimeReservations = dailyData.reduce(
    (sum, row) => sum + row.firstTimeReservations,
    0
  );
  const totalFirstTimeImplementations = dailyData.reduce(
    (sum, row) => sum + row.firstTimeImplementations,
    0
  );
  const totalRepeatReservations = dailyData.reduce((sum, row) => sum + row.repeatReservations, 0);
  const totalRepeatImplementations = dailyData.reduce(
    (sum, row) => sum + row.repeatImplementations,
    0
  );
  const totalReservations = totalFirstTimeReservations + totalRepeatReservations;

  return {
    date: 'TTL',
    firstTimeReservations: totalFirstTimeReservations,
    firstTimeReservationRate:
      totalReservations > 0 ? (totalFirstTimeReservations / totalReservations) * 100 : 0,
    firstTimeImplementations: totalFirstTimeImplementations,
    firstTimeImplementationRate:
      totalFirstTimeReservations > 0
        ? (totalFirstTimeImplementations / totalFirstTimeReservations) * 100
        : 0,
    repeatReservations: totalRepeatReservations,
    repeatReservationRate:
      totalReservations > 0 ? (totalRepeatReservations / totalReservations) * 100 : 0,
    repeatImplementations: totalRepeatImplementations,
    repeatImplementationRate:
      totalRepeatReservations > 0
        ? (totalRepeatImplementations / totalRepeatReservations) * 100
        : 0,
  };
}

/**
 * 日別集計データをCSV形式でエクスポート
 * 日付列 + AB〜AM列（計9列）を出力
 */
export function exportDailySpreadsheetCSV(
  csvData: CsvRecord[],
  masterData: Map<string, UserHistoryMaster>,
  fileName: string = 'daily_spreadsheet.csv'
): void {
  const dailyData = generateDailySpreadsheetData(csvData, masterData);
  const ttlRow = generateTTLRow(dailyData);

  // TTL行を先頭に追加
  const allRows = [ttlRow, ...dailyData];

  // ヘッダー行
  const headers = [
    '日付',
    '初回キャリア相談予約【合計】',
    '初回キャリア相談予約【初回予約率】',
    '初回キャリア相談実施【合計】',
    '初回キャリア相談実施【初回実施率】',
    '2回目以降予約【件数】',
    '2回目以降予約【予約率】',
    '2回目以降実施【件数】',
    '2回目以降実施【実施率】',
  ];
  const headerRow = headers.join(',');

  // データ行（日付列 + AB〜AM列の8列 = 計9列）
  const dataRows = allRows.map((row) => {
    return [
      row.date,
      row.firstTimeReservations,
      Math.round(row.firstTimeReservationRate * 10) / 10, // 小数第1位まで
      row.firstTimeImplementations,
      Math.round(row.firstTimeImplementationRate * 10) / 10,
      row.repeatReservations,
      Math.round(row.repeatReservationRate * 10) / 10,
      row.repeatImplementations,
      Math.round(row.repeatImplementationRate * 10) / 10,
    ].join(',');
  });

  // CSV文字列を結合（ヘッダー行 + TTL行 + 日付行）
  const csvContent = [headerRow, ...dataRows].join('\n');

  // BOMを付けてUTF-8で保存
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]); // UTF-8 BOM
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });

  // ダウンロードリンクを作成
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
