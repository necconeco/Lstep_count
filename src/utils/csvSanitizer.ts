/**
 * CSV Injection (Formula Injection) 対策ユーティリティ
 *
 * CSVファイルに含まれる数式文字（=, +, -, @, \t, \r）を無害化して、
 * ExcelなどのスプレッドシートアプリケーションでCSVを開いた際に
 * 意図しない数式実行やコマンド実行を防ぐ。
 *
 * 参考: OWASP CSV Injection
 * https://owasp.org/www-community/attacks/CSV_Injection
 */

/**
 * CSV Injection攻撃のリスクがある文字パターン
 * - '=' : 数式の開始
 * - '+' : 数式の開始（一部のスプレッドシート）
 * - '-' : 数式の開始（一部のスプレッドシート）
 * - '@' : 数式の開始（一部のスプレッドシート）
 * - '\t' : タブ（フィールド区切りの混乱を招く）
 * - '\r' : キャリッジリターン（行区切りの混乱を招く）
 */
const DANGEROUS_CHARS = /^[=+\-@\t\r]/;

/**
 * CSV値を安全にエスケープする
 *
 * 1. 数式文字で始まる値にはシングルクォート(')をプレフィックス
 * 2. カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
 * 3. ダブルクォートを含む場合は2つに置換
 *
 * @param value - エスケープ対象の文字列
 * @returns エスケープ済みの文字列
 */
export function sanitizeCSVValue(value: string): string {
  // 空文字列の場合はそのまま返す
  if (value === '') {
    return '';
  }

  // 文字列に変換（数値や他の型が渡された場合の対策）
  const stringValue = String(value);

  // 1. CSV Injection対策: 数式文字で始まる場合はシングルクォートでプレフィックス
  let sanitized = stringValue;
  if (DANGEROUS_CHARS.test(stringValue)) {
    sanitized = "'" + stringValue;
  }

  // 2. 通常のCSVエスケープ: カンマ、改行、ダブルクォートを含む場合
  if (sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('"')) {
    // ダブルクォートを2つに置換してエスケープし、全体をダブルクォートで囲む
    sanitized = `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}

/**
 * CSV Injection攻撃のリスクがあるかチェック
 *
 * @param value - チェック対象の文字列
 * @returns 危険な文字で始まる場合はtrue
 */
export function isDangerousCSVValue(value: string): boolean {
  if (!value || value === '') {
    return false;
  }

  return DANGEROUS_CHARS.test(String(value));
}

/**
 * 数値をCSV値として安全にフォーマット
 * 数値の場合はそのまま返す（数式として解釈されるリスクがないため）
 *
 * @param value - 数値
 * @returns 文字列化された数値
 */
export function formatNumberForCSV(value: number): string {
  return String(value);
}
