/**
 * コースマスターデータ
 *
 * 公式コース一覧を定義
 * - 集計ビューでのコース候補
 * - セレクトボックスの選択肢
 * - 件数0のコースも表示するためのマスター
 */

/**
 * 公式コース一覧（表示順）
 */
export const OFFICIAL_COURSES = [
  '学び直し',
  '習慣化サポート',
  'キャリアアップ',
  '資格・勉強',
  'ワーママ',
  '定年後',
  '復職復帰',
  'スキルアップ',
  '将来の不安',
  'ゆるく相談したい',
  'その他',
] as const;

/**
 * コース名の型
 */
export type OfficialCourseName = (typeof OFFICIAL_COURSES)[number];

/**
 * コースがマスターに存在するかチェック
 */
export function isOfficialCourse(courseName: string): courseName is OfficialCourseName {
  return OFFICIAL_COURSES.includes(courseName as OfficialCourseName);
}

/**
 * コース名を正規化（トリム、全角半角統一など）
 * 現状はトリムのみ
 */
export function normalizeCourseNameForMatching(courseName: string): string {
  return courseName.trim();
}

/**
 * マスターに存在しないコースを「その他」として扱うかどうかを判定
 * 空文字・未設定の場合は「その他」として扱わない（未設定として別扱い）
 */
export function getEffectiveCourseName(courseName: string | undefined | null): string | null {
  if (!courseName || courseName.trim() === '') {
    return null; // 未設定
  }
  const normalized = normalizeCourseNameForMatching(courseName);
  if (isOfficialCourse(normalized)) {
    return normalized;
  }
  // マスターにないコースはそのまま返す（「その他」には自動変換しない）
  return normalized;
}
