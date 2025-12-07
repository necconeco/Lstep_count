/**
 * 担当者マスターデータ（正式メンバー）
 *
 * 10名の正式担当者を定義
 */

/**
 * 正式担当者リスト（10名）
 * G列（予約枠）と照合し、一致すればstaffIdに紐付ける
 */
export const OFFICIAL_STAFF_MEMBERS: readonly string[] = [
  '佐々木宏明',
  '塩見千重子',
  '押谷ゆきな',
  '河野孝匡',
  '桑名晃一',
  '松浦多恵',
  'あんどう ちえ',
  '峯藤 誠',
  '市原',
  'J.K',
] as const;

/**
 * おまかせ判定パターン（調整系コメント）
 * これらのパターンが含まれる予約枠は「おまかせ扱い」
 * 例: 「塩見千重子（予約日により別日の調整を依頼する可能性があります）」
 * → staffId = null, wasOmakase = true
 */
export const OMAKASE_PATTERNS: readonly RegExp[] = [
  /事務局にお任せ/,
  /お任せ/,
  /おまかせ/,
  /予約日により別日の調整を依頼する可能性があります/,
  /担当者変更の可能性があります/,
  /日程が変更になる可能性があります/,
  /調整中/,
];

/**
 * 備考コメント判定パターン
 * これらのパターンに一致する予約枠は「備考コメント」扱い
 * → staffId = null, wasOmakase = false
 */
export const COMMENT_PATTERNS: readonly RegExp[] = [
  /^※/, // 「※」で始まる
  /時間変更/, // 時間変更の可能性
  /別日調整/, // 別日調整依頼
];

// ============================================================================
// 正規化ヘルパー
// ============================================================================

/**
 * 文字列を正規化（表記揺れ対策）
 * - 前後スペース除去
 * - 全角英数字→半角
 * - 全角スペース→半角スペース
 */
function normalizeString(str: string): string {
  return (
    str
      .trim()
      // 全角英数字→半角
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      // 全角ピリオド→半角
      .replace(/．/g, '.')
      // 全角スペース→半角
      .replace(/\u3000/g, ' ')
  );
}

/**
 * 括弧以降を削除
 * 例: 「塩見千重子（予約日により...）」→「塩見千重子」
 */
function removeParentheses(str: string): string {
  return str.replace(/[（(].*/g, '').trim();
}

// ============================================================================
// 判定関数
// ============================================================================

/**
 * 予約枠から担当者情報を判定
 *
 * 判定順序:
 * 1. おまかせ/調整パターンに一致 → wasOmakase = true（担当者名が含まれていても）
 * 2. 備考コメントパターンに一致 → staff = null, wasOmakase = false
 * 3. 正式担当者名と完全一致（正規化後）→ staff に設定
 * 4. いずれにも該当しない → staff = null, wasOmakase = false
 *
 * 重要: 「担当者名＋調整コメント」は「おまかせ扱い」になります
 * 例: 「塩見千重子（予約日により別日の調整を依頼する可能性があります）」→ おまかせ
 *
 * @param reservationSlot G列（予約枠）の値
 * @returns { staffName: string | null, wasOmakase: boolean }
 */
export function classifyReservationSlot(reservationSlot: string | undefined | null): {
  staffName: string | null;
  wasOmakase: boolean;
} {
  if (!reservationSlot || reservationSlot.trim() === '') {
    return { staffName: null, wasOmakase: false };
  }

  const slot = reservationSlot.trim();

  // 1. おまかせ/調整パターンの判定（最優先）
  // 「担当者名＋調整コメント」もおまかせ扱いにする
  for (const pattern of OMAKASE_PATTERNS) {
    if (pattern.test(slot)) {
      return { staffName: null, wasOmakase: true };
    }
  }

  // 2. 備考コメントパターンの判定
  for (const pattern of COMMENT_PATTERNS) {
    if (pattern.test(slot)) {
      return { staffName: null, wasOmakase: false };
    }
  }

  // 3. 正式担当者との照合
  // 括弧以降を削除して正規化
  const normalizedSlot = normalizeString(removeParentheses(slot));

  for (const staffName of OFFICIAL_STAFF_MEMBERS) {
    const normalizedStaffName = normalizeString(staffName);

    // 完全一致
    if (normalizedSlot === normalizedStaffName) {
      return { staffName, wasOmakase: false };
    }
  }

  // 4. どれにも該当しない → 担当者なし（備考扱い）
  return { staffName: null, wasOmakase: false };
}

/**
 * 担当者名が正式メンバーかどうかを判定
 */
export function isOfficialStaffMember(name: string): boolean {
  return OFFICIAL_STAFF_MEMBERS.includes(name);
}

/**
 * 予約枠がおまかせかどうかを判定
 */
export function isOmakaseSlot(reservationSlot: string | undefined | null): boolean {
  if (!reservationSlot) return false;
  const slot = reservationSlot.trim();

  for (const pattern of OMAKASE_PATTERNS) {
    if (pattern.test(slot)) {
      return true;
    }
  }
  return false;
}
