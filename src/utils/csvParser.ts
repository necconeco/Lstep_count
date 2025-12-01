/**
 * CSVパース処理
 * PapaParse使用
 */
import Papa from 'papaparse';
import type { CsvRecord, ParseResult } from '../types';

/**
 * 必須カラムのリスト
 */
const REQUIRED_COLUMNS = ['予約ID', '友だちID', '予約日', 'ステータス', '来店/来場', '名前', '申込日時'];

/**
 * CSVファイルをパースしてCsvRecord配列に変換
 */
export async function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim(),
      complete: (results) => {
        try {
          // ヘッダー検証
          const headers = results.meta.fields || [];
          const missingColumns = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));

          if (missingColumns.length > 0) {
            errors.push(`必須カラムが不足しています: ${missingColumns.join(', ')}`);
            resolve({
              success: false,
              data: [],
              errors,
              warnings,
            });
            return;
          }

          // データ変換
          const data: CsvRecord[] = [];

          results.data.forEach((row, index) => {
            // 必須フィールドチェック
            const missingFields = REQUIRED_COLUMNS.filter((col) => !row[col]);
            if (missingFields.length > 0) {
              warnings.push(`行${index + 2}: 必須フィールドが空です: ${missingFields.join(', ')}`);
              return; // このレコードはスキップ
            }

            // ステータスバリデーション
            const status = row['ステータス'];
            if (status !== '予約済み' && status !== 'キャンセル済み') {
              warnings.push(`行${index + 2}: 不明なステータス「${status}」`);
            }

            // 来店/来場バリデーション
            const visit = row['来店/来場'];
            if (visit !== '済み' && visit !== 'なし') {
              warnings.push(`行${index + 2}: 不明な来店/来場ステータス「${visit}」`);
            }

            // CsvRecordに変換
            const csvRecord: CsvRecord = {
              予約ID: row['予約ID'] || '',
              友だちID: row['友だちID'] || '',
              予約日: row['予約日'] || '',
              ステータス: (status === '予約済み' || status === 'キャンセル済み')
                ? status
                : '予約済み', // デフォルト
              '来店/来場': (visit === '済み' || visit === 'なし')
                ? visit
                : 'なし', // デフォルト
              名前: row['名前'] || '',
              申込日時: row['申込日時'] || '',
              メモ: row['メモ'],
              担当者: row['担当者'],
            };

            // その他のフィールドも追加
            Object.keys(row).forEach((key) => {
              if (!REQUIRED_COLUMNS.includes(key) && key !== 'メモ' && key !== '担当者') {
                csvRecord[key] = row[key];
              }
            });

            data.push(csvRecord);
          });

          // パースエラーチェック
          if (results.errors.length > 0) {
            results.errors.forEach((error) => {
              warnings.push(`パースエラー (行${error.row}): ${error.message}`);
            });
          }

          resolve({
            success: data.length > 0,
            data,
            errors: data.length === 0 ? ['有効なデータが見つかりませんでした'] : [],
            warnings,
          });
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : 'CSVパース中に予期しないエラーが発生しました'
          );
          resolve({
            success: false,
            data: [],
            errors,
            warnings,
          });
        }
      },
      error: (error) => {
        errors.push(`ファイル読み込みエラー: ${error.message}`);
        resolve({
          success: false,
          data: [],
          errors,
          warnings,
        });
      },
    });
  });
}

/**
 * CSVファイルのバリデーション
 */
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
  // ファイルタイプチェック
  if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
    return {
      valid: false,
      error: 'CSVファイルを選択してください（拡張子: .csv）',
    };
  }

  // ファイルサイズチェック（10MB）
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `ファイルサイズが大きすぎます（最大: ${MAX_FILE_SIZE / 1024 / 1024}MB）`,
    };
  }

  // ファイルサイズチェック（最小）
  if (file.size === 0) {
    return {
      valid: false,
      error: 'ファイルが空です',
    };
  }

  return { valid: true };
}
