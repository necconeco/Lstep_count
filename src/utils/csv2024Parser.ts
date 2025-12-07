/**
 * 2024年CSV専用パーサー
 *
 * 2024年のCSVは2025年以降と列構成が異なるため、
 * 専用のパーサーで共通フォーマット（CsvRecord）にマッピングする。
 *
 * 2024年データの取り込みルール:
 * - 担当者: null（全件・担当者未割当）
 * - コース: null（コース概念がなかった）
 * - キャンセル: シンプル判定（前日/当日の区別なし）
 * - visitIndex: 通常通り計算（初回/2回目判定は行う）
 */
import Papa from 'papaparse';
import type { CsvRecord, ParseResult } from '../types';

/**
 * 2024年CSVのカラム名マッピング
 * 実際の2024年CSVのヘッダーに合わせて調整が必要な場合があります
 */
const COLUMN_MAPPING_2024: Record<string, string> = {
  // 日付関連
  日付: '予約日',
  予約日: '予約日',

  // 名前関連
  お客さま: '名前',
  お客様: '名前',
  名前: '名前',

  // 申込日時関連
  申し込み日時: '申込日時',
  申込日時: '申込日時',

  // ステータス関連（2024年独自の可能性）
  ステータス: 'ステータス',
  予約ステータス: 'ステータス',
  状態: 'ステータス',

  // 来店関連（2024年独自の可能性）
  '来店/来場': '来店/来場',
  来店: '来店/来場',
  来場: '来店/来場',
  実施: '来店/来場',
};

/**
 * 2024年CSVの必須カラム（緩い条件）
 * 最低限これだけあればパース可能
 */
const REQUIRED_COLUMNS_2024 = ['友だちID', '予約日', '名前'];

/**
 * 2024年のステータスを正規化
 * 様々な表記を '予約済み' / 'キャンセル済み' に統一
 */
function normalizeStatus2024(rawStatus: string): '予約済み' | 'キャンセル済み' {
  const status = rawStatus?.trim().toLowerCase() || '';

  // キャンセル系
  if (
    status.includes('キャンセル') ||
    status.includes('cancel') ||
    status === '取消' ||
    status === '中止'
  ) {
    return 'キャンセル済み';
  }

  // デフォルトは予約済み
  return '予約済み';
}

/**
 * 2024年の来店/来場を正規化
 * 様々な表記を '済み' / 'なし' に統一
 */
function normalizeVisit2024(rawVisit: string, rawStatus: string): '済み' | 'なし' {
  const visit = rawVisit?.trim().toLowerCase() || '';
  const status = rawStatus?.trim().toLowerCase() || '';

  // 明示的に来店済み
  if (
    visit === '済み' ||
    visit === '済' ||
    visit === '完了' ||
    visit === '来店' ||
    visit === '来場' ||
    visit === '実施済み' ||
    visit === '実施' ||
    visit === 'done' ||
    visit === 'completed'
  ) {
    return '済み';
  }

  // ステータスから判定（来店/来場列がない場合のフォールバック）
  if (
    status.includes('完了') ||
    status.includes('来店') ||
    status.includes('来場') ||
    status.includes('実施')
  ) {
    return '済み';
  }

  // キャンセルの場合は必ず「なし」
  if (status.includes('キャンセル') || status.includes('cancel')) {
    return 'なし';
  }

  // 明示的に未来店
  if (
    visit === 'なし' ||
    visit === '未' ||
    visit === '未来店' ||
    visit === '未実施'
  ) {
    return 'なし';
  }

  // デフォルトは「なし」
  return 'なし';
}

/**
 * CSVが2024年形式かどうかを判定
 *
 * 判定基準:
 * 1. ファイル名に '2024' が含まれる
 * 2. ヘッダーに '予約枠' 列がない（2025年以降の特徴的な列）
 * 3. ヘッダーに2024年特有の列がある（将来的な拡張用）
 */
export function is2024Format(headers: string[], fileName?: string): boolean {
  // ファイル名に2024が含まれる場合
  if (fileName && fileName.includes('2024')) {
    return true;
  }

  // 2025年以降の特徴的な列がない場合
  const has2025Columns = headers.some(
    h =>
      h === '予約枠' ||
      h === '予約枠（担当者名）' ||
      h === 'コース'
  );

  if (!has2025Columns) {
    // 最低限の列があれば2024年形式とみなす
    const hasMinimumColumns = headers.includes('友だちID') && headers.includes('予約日');
    if (hasMinimumColumns) {
      return true;
    }
  }

  return false;
}

/**
 * 2024年CSVをパース
 */
export async function parse2024CSV(
  csvText: string,
  fileName?: string
): Promise<ParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  return new Promise(resolve => {
    Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim(),
      complete: results => {
        try {
          const headers = results.meta.fields || [];

          // 2024年形式かどうか確認
          if (!is2024Format(headers, fileName)) {
            warnings.push('2024年形式ではない可能性があります。通常のパーサーを使用してください。');
          }

          // カラムマッピングを適用
          const mappedHeaders = headers.map(h => COLUMN_MAPPING_2024[h] || h);

          // 必須カラムチェック（緩い条件）
          const missingColumns = REQUIRED_COLUMNS_2024.filter(
            col => !mappedHeaders.includes(col) && !headers.includes(col)
          );

          if (missingColumns.length > 0) {
            errors.push(`必須カラムが不足しています: ${missingColumns.join(', ')}`);
            errors.push(`検出されたヘッダー: ${headers.join(', ')}`);
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
            // カラムマッピングを適用した行データを作成
            const mappedRow: Record<string, string> = {};
            Object.keys(row).forEach(key => {
              const mappedKey = COLUMN_MAPPING_2024[key] || key;
              mappedRow[mappedKey] = row[key] || '';
            });

            // 友だちIDと予約日は必須
            if (!mappedRow['友だちID'] || !mappedRow['予約日']) {
              warnings.push(`行${index + 2}: 友だちIDまたは予約日が空のためスキップ`);
              return;
            }

            // ステータスと来店/来場を正規化
            const rawStatus = mappedRow['ステータス'] || mappedRow['予約ステータス'] || mappedRow['状態'] || '';
            const rawVisit = mappedRow['来店/来場'] || mappedRow['来店'] || mappedRow['来場'] || mappedRow['実施'] || '';

            const normalizedStatus = normalizeStatus2024(rawStatus);
            const normalizedVisit = normalizeVisit2024(rawVisit, rawStatus);

            // 予約IDを自動生成
            const reservationId = mappedRow['予約ID'] || `2024_${String(index + 1).padStart(5, '0')}`;

            // 申込日時がない場合は予約日を使用
            const applicationDate = mappedRow['申込日時'] || mappedRow['予約日'] || '';

            // CsvRecordに変換（2024年ルール適用）
            const csvRecord: CsvRecord = {
              予約ID: reservationId,
              友だちID: mappedRow['友だちID'],
              予約日: mappedRow['予約日'],
              ステータス: normalizedStatus,
              '来店/来場': normalizedVisit,
              名前: mappedRow['名前'] || '不明',
              申込日時: applicationDate,
              メモ: mappedRow['メモ'] || mappedRow['予約メモ'] || mappedRow['備考'],

              // 2024年ルール: 担当者は全てnull（未割当）
              担当者: undefined,
              wasOmakase: false,

              // 2024年ルール: コースはundefined（不明として扱う）
              // コース列は追加しない（後続処理で「不明」として扱われる）
            };

            data.push(csvRecord);
          });

          // パースエラーチェック
          if (results.errors.length > 0) {
            results.errors.forEach(error => {
              warnings.push(`パースエラー (行${error.row}): ${error.message}`);
            });
          }

          // 2024年データ取り込み完了メッセージ
          if (data.length > 0) {
            warnings.push(`[2024年形式] ${data.length}件のレコードを取り込みました（担当者=未割当、コース=不明）`);
          }

          resolve({
            success: data.length > 0,
            data,
            errors: data.length === 0 ? ['有効なデータが見つかりませんでした'] : [],
            warnings,
          });
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : '2024年CSVパース中に予期しないエラーが発生しました'
          );
          resolve({
            success: false,
            data: [],
            errors,
            warnings,
          });
        }
      },
      error: (error: Error) => {
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
