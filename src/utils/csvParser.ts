/**
 * CSVパース処理
 * PapaParse使用
 *
 * 2024年と2025年以降のCSV形式を自動判定して適切にパースします。
 * - 2024年: 担当者=null, コース=不明, キャンセル=シンプル判定
 * - 2025年以降: 通常のパース処理
 */
import Papa from 'papaparse';
import type { CsvRecord, ParseResult } from '../types';
import { classifyReservationSlot } from '../domain';
import { is2024Format, parse2024CSV } from './csv2024Parser';

/**
 * カラム名のマッピング（LステップCSV → 内部形式）
 * 複数のバリエーションに対応
 */
const COLUMN_MAPPING: Record<string, string> = {
  // 日付関連
  日付: '予約日',
  予約日: '予約日',

  // 名前関連
  お客さま: '名前',
  お客様: '名前',
  名前: '名前',

  // 申込日時関連（全角・半角・スペースのバリエーション）
  申し込み日時: '申込日時',
  申込日時: '申込日時',

  // 予約枠
  予約枠: '_予約枠',

  // その他のバリエーション
  '予約枠（担当者名）': '_予約枠',
};

/**
 * 必須カラムのリスト（内部形式）
 * 予約IDは自動生成するため必須から除外
 */
const REQUIRED_COLUMNS = ['友だちID', '予約日', 'ステータス', '来店/来場', '名前', '申込日時'];

// 担当者判定ロジックは domain/staffMasterData.ts に移動済み
// classifyReservationSlot() を使用

/**
 * ファイルを指定されたエンコーディングで読み込む
 * Shift-JISとUTF-8の両方に対応
 */
async function readFileWithEncoding(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      if (!arrayBuffer) {
        reject(new Error('ファイルの読み込みに失敗しました'));
        return;
      }

      try {
        // まずShift-JISで試す（LステップCSVの標準エンコーディング）
        const decoder = new TextDecoder('Shift-JIS');
        const text = decoder.decode(arrayBuffer);

        // デコード結果が正常かチェック（文字化けしていないか）
        // 日本語のヘッダーが含まれているはずなので、それを確認
        if (
          text.includes('友だちID') ||
          text.includes('お客さま') ||
          text.includes('日付') ||
          text.includes('ステータス')
        ) {
          resolve(text);
          return;
        }

        // Shift-JISでデコードできなかった場合、UTF-8で試す
        const utf8Decoder = new TextDecoder('UTF-8');
        const utf8Text = utf8Decoder.decode(arrayBuffer);
        resolve(utf8Text);
      } catch {
        // エンコーディングエラーの場合、UTF-8で試す
        try {
          const utf8Decoder = new TextDecoder('UTF-8');
          const utf8Text = utf8Decoder.decode(arrayBuffer);
          resolve(utf8Text);
        } catch {
          reject(
            new Error(
              'ファイルのエンコーディングを判定できませんでした。UTF-8またはShift-JISのCSVファイルを使用してください。'
            )
          );
        }
      }
    };

    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * CSVファイルをパースしてCsvRecord配列に変換
 * 2024年形式と2025年以降の形式を自動判定して適切にパースします
 */
export async function parseCSV(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // ファイルをShift-JIS/UTF-8で読み込み
    const csvText = await readFileWithEncoding(file);

    // まずヘッダーだけを取得して形式を判定
    const headerResult = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      preview: 1, // 1行だけパース（ヘッダー取得用）
    });
    const headers = headerResult.meta.fields || [];

    // 2024年形式かどうか判定
    if (is2024Format(headers, file.name)) {
      // 2024年専用パーサーを使用
      return parse2024CSV(csvText, file.name);
    }

    // 2025年以降の通常パース処理
    return new Promise(resolve => {
      Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        transform: (value: string) => value.trim(),
        complete: results => {
          try {
            // ヘッダー検証（カラムマッピングを考慮）
            const resultHeaders = results.meta.fields || [];

            // カラムマッピングを適用したヘッダーを作成
            const mappedHeaders = resultHeaders.map(h => COLUMN_MAPPING[h] || h);

            // 必須カラムのチェック
            const missingColumns = REQUIRED_COLUMNS.filter(col => !mappedHeaders.includes(col));

            if (missingColumns.length > 0) {
              console.error('[CSV Parser] 期待されるカラム:', REQUIRED_COLUMNS);
              errors.push(`必須カラムが不足しています: ${missingColumns.join(', ')}`);
              errors.push(`デバッグ: 検出されたヘッダー: ${resultHeaders.join(', ')}`);
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
                const mappedKey = COLUMN_MAPPING[key] || key;
                mappedRow[mappedKey] = row[key] || '';
              });

              // 必須フィールドチェック
              const missingFields = REQUIRED_COLUMNS.filter(col => !mappedRow[col]);
              if (missingFields.length > 0) {
                warnings.push(`行${index + 2}: 必須フィールドが空です: ${missingFields.join(', ')}`);
                return; // このレコードはスキップ
              }

              // ステータスバリデーション
              const status = mappedRow['ステータス'];
              if (status !== '予約済み' && status !== 'キャンセル済み') {
                warnings.push(`行${index + 2}: 不明なステータス「${status}」`);
              }

              // 来店/来場バリデーション
              const visit = mappedRow['来店/来場'];
              if (visit !== '済み' && visit !== 'なし') {
                warnings.push(`行${index + 2}: 不明な来店/来場ステータス「${visit}」`);
              }

              // 予約IDを自動生成（存在しない場合）
              const reservationId = mappedRow['予約ID'] || `AUTO_${String(index + 1).padStart(5, '0')}`;

              // 担当者名を予約枠から抽出（おまかせ判定も含む）
              // 新ロジック: 正式担当者10名 / おまかせパターン / 備考コメントを判定
              const staffInfo = classifyReservationSlot(mappedRow['_予約枠']);
              const staffName = mappedRow['担当者'] || staffInfo.staffName || undefined;
              const wasOmakase = staffInfo.wasOmakase;

              // CsvRecordに変換
              const csvRecord: CsvRecord = {
                予約ID: reservationId,
                友だちID: mappedRow['友だちID'] || '',
                予約日: mappedRow['予約日'] || '',
                ステータス: status === '予約済み' || status === 'キャンセル済み' ? status : '予約済み', // デフォルト
                '来店/来場': visit === '済み' || visit === 'なし' ? visit : 'なし', // デフォルト
                名前: mappedRow['名前'] || '',
                申込日時: mappedRow['申込日時'] || '',
                メモ: mappedRow['メモ'],
                担当者: staffName,
                wasOmakase, // おまかせ予約フラグ
              };

              // その他のフィールドも追加（内部処理用フィールドを除く）
              Object.keys(mappedRow).forEach(key => {
                if (!REQUIRED_COLUMNS.includes(key) && key !== 'メモ' && key !== '担当者' && !key.startsWith('_')) {
                  csvRecord[key] = mappedRow[key];
                }
              });

              data.push(csvRecord);
            });

            // パースエラーチェック
            if (results.errors.length > 0) {
              results.errors.forEach(error => {
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
            errors.push(error instanceof Error ? error.message : 'CSVパース中に予期しないエラーが発生しました');
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
  } catch (error) {
    // readFileWithEncodingでのエラーをキャッチ
    errors.push(error instanceof Error ? error.message : 'ファイルのエンコーディング処理中にエラーが発生しました');
    return {
      success: false,
      data: [],
      errors,
      warnings,
    };
  }
}

/**
 * CSVファイルのバリデーション
 */
export function validateCSVFile(file: File): { valid: boolean; error?: string | null } {
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

  return { valid: true, error: null };
}
