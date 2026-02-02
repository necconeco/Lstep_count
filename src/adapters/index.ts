/**
 * Adapter層 - 公開API
 *
 * このファイルはAdapter層の公開インターフェースを定義します。
 * 外部からはこのファイル経由でAdapter層の機能にアクセスしてください。
 *
 * 責務:
 * - UI層（CsvRecord）とDomain層（CsvInputRecord）間の変換
 * - 日付パース
 * - ID生成
 */

export {
  // 日付パース
  parseDate,
  parseDateTime,

  // CsvRecord → CsvInputRecord 変換（新設計用）
  toCsvInputRecord,
  toCsvInputRecords,

  // CsvRecord → MasterCsvInputRecord 変換（マスターマージ用）
  toMasterCsvInputRecord,
  toMasterCsvInputRecords,

  // ID生成
  generateAuditLogId,
  generateGroupId,
} from './csvAdapter';
