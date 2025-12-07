/**
 * 実施候補検出ユーティリティ
 * CSVデータから「実施された可能性がある行」を抽出
 */
import type { CsvRecord } from '../types';

/**
 * 実施候補の判定結果
 */
export interface ImplementationCandidate {
  record: CsvRecord;
  isCandidate: boolean; // 実施候補かどうか
  reason: string; // 判定理由
  shouldIncludeInMaster: boolean; // マスターに含めるべきか（初期値true）
  isDeleted: boolean; // 削除フラグ
}

/**
 * 実施候補かどうかを判定
 *
 * 判定条件：
 * ✅ 実施候補：
 *   1. ステータス：予約済み + 来店/来場：済み
 *   2. ステータス：キャンセル済み + 詳細ステータス：前日 or 当日
 *      → 来店扱い（実施としてカウント）
 *
 * ❌ 通常キャンセル（マスターには登録しない）：
 *   - ステータス：キャンセル済み
 *   - かつ 来店/来場：なし
 *   - かつ 詳細ステータスが前日/当日ではない
 *
 * @param record CSVレコード
 * @returns 実施候補の判定結果
 */
export function detectImplementationCandidate(record: CsvRecord): ImplementationCandidate {
  const status = record.ステータス;
  const visit = record['来店/来場'];
  const detailStatus = record.詳細ステータス;

  // パターン1: 予約済み + 来店/来場が「済み」
  if (status === '予約済み' && visit === '済み') {
    return {
      record,
      isCandidate: true,
      reason: '予約済み + 来店済み',
      shouldIncludeInMaster: true,
      isDeleted: false,
    };
  }

  // パターン2: キャンセル済み + 詳細ステータスが「前日キャンセル」or「当日キャンセル」
  // → 来店扱い（実施としてカウント）
  // ユーザーがUI上で手動マーキングしたレコードのみ実施扱い
  if (status === 'キャンセル済み' && detailStatus) {
    if (detailStatus === '前日キャンセル' || detailStatus === '当日キャンセル') {
      return {
        record,
        isCandidate: true,
        reason: `キャンセル済み（${detailStatus}）→ 来店扱い`,
        shouldIncludeInMaster: true,
        isDeleted: false,
      };
    }
  }

  // パターン3: 通常キャンセル（キャンセル済み + 来店/来場が「なし」）
  if (status === 'キャンセル済み' && visit === 'なし') {
    return {
      record,
      isCandidate: false,
      reason: '通常キャンセル（来店なし）',
      shouldIncludeInMaster: false,
      isDeleted: false,
    };
  }

  // その他：実施候補ではない
  return {
    record,
    isCandidate: false,
    reason: `実施候補外（ステータス: ${status}、来店/来場: ${visit}）`,
    shouldIncludeInMaster: false,
    isDeleted: false,
  };
}

/**
 * CSVデータから実施候補を抽出
 * @param csvData CSVレコード配列
 * @returns 実施候補のリスト
 */
export function extractImplementationCandidates(csvData: CsvRecord[]): ImplementationCandidate[] {
  return csvData.map(record => detectImplementationCandidate(record)).filter(candidate => candidate.isCandidate); // 実施候補のみを返す
}
