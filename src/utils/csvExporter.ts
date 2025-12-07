/**
 * CSV出力ユーティリティ（Infrastructure層）
 * データをCSV形式でファイル出力するだけの純粋なInfrastructure層
 *
 * セキュリティ: CSV Injection対策済み（sanitizeCSVValue使用）
 */
import type { CsvRecord } from '../types';
import { sanitizeCSVValue } from './csvSanitizer';

/**
 * CSVレコードをCSV形式の文字列に変換してダウンロード
 *
 * 注意: この関数は純粋なファイル出力のみを行います。
 * ビジネスロジック（回数判定・自動補完など）は呼び出し元で実行してください。
 *
 * セキュリティ対策:
 * - CSV Injection (Formula Injection) 対策済み
 * - 数式文字（=, +, -, @, \t, \r）で始まる値はシングルクォートでプレフィックス
 */
export function exportToCSV(records: CsvRecord[], fileName: string = 'export.csv'): void {
  if (records.length === 0) {
    console.warn('エクスポートするデータがありません');
    return;
  }

  // レコードはそのまま使用（前処理済みと想定）
  const processedRecords = records;

  // ヘッダー行を生成（最初のレコードのキーを使用）
  const firstRecord = processedRecords[0];
  if (!firstRecord) {
    console.warn('レコードが空です');
    return;
  }
  const headers = Object.keys(firstRecord); // 詳細ステータスも含める
  // ヘッダーもサニタイズ（万が一、ヘッダーに危険な文字が含まれていた場合）
  const headerRow = headers.map(sanitizeCSVValue).join(',');

  // データ行を生成（processedRecordsを使用）
  const dataRows = processedRecords.map(record => {
    return headers
      .map(header => {
        const value = record[header];
        // boolean型の場合はスキップ（wasOmakase等）
        if (typeof value === 'boolean') return '';
        // sanitizeCSVValueで安全にエスケープ
        return sanitizeCSVValue(String(value ?? ''));
      })
      .join(',');
  });

  // CSV文字列を結合
  const csvContent = [headerRow, ...dataRows].join('\n');

  // BOMを付けてUTF-8として出力
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
