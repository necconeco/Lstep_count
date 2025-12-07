/**
 * Domain層 - ビジネスロジック（純粋関数）
 *
 * - CSVマージ（重複排除、後勝ち）
 * - visitIndex計算
 * - 実施判定
 * - 集計ロジック
 */

import type {
  ReservationHistory,
  UserVisitCount,
  CsvInputRecord,
  VisitLabel,
  CampaignMaster,
  AggregationSummary,
  DailyAggregation,
  FlatRecord,
  TargetDateType,
  ImplementationRule,
  CancelTiming,
} from './types';

// ============================================================================
// ユーティリティ
// ============================================================================

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日付をYYYY-MM-DD HH:mm形式にフォーマット
 */
export function formatDateTime(date: Date): string {
  const dateStr = formatDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`;
}

/**
 * 来店回数からVisitLabelを取得
 */
export function getVisitLabel(visitIndex: number): VisitLabel {
  if (visitIndex === 1) return '初回';
  if (visitIndex === 2) return '2回目';
  return '3回目以降';
}

/**
 * キャンセルタイミングを判定
 *
 * 判定ロジック:
 * - 実施日（sessionDate）と申込日（applicationDate）の日数差で判定
 * - 同日 → 当日キャンセル
 * - 1日差 → 前日キャンセル
 * - 2日以上差 → 早期キャンセル
 *
 * @param sessionDate 実施日（予約日）
 * @param applicationDate 申込日時
 * @param status 予約ステータス
 * @returns キャンセルタイミング
 */
export function getCancelTiming(
  sessionDate: Date,
  applicationDate: Date,
  status: '予約済み' | 'キャンセル済み'
): CancelTiming {
  // キャンセルでない場合
  if (status !== 'キャンセル済み') {
    return 'none';
  }

  // 日付の時刻部分を除去して比較
  const session = new Date(sessionDate);
  session.setHours(0, 0, 0, 0);

  const application = new Date(applicationDate);
  application.setHours(0, 0, 0, 0);

  // 日数差を計算（ミリ秒 → 日）
  const diffMs = session.getTime() - application.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // 実施日と申込日が同日 → 当日キャンセル
    return 'same-day';
  } else if (diffDays === 1) {
    // 実施日の1日前に申込 → 前日キャンセル
    return 'previous-day';
  } else {
    // それ以上前 → 早期キャンセル
    return 'early';
  }
}

/**
 * 文字列の日付からキャンセルタイミングを判定（表示用）
 *
 * @param sessionDateStr YYYY-MM-DD形式
 * @param applicationDateStr YYYY-MM-DD HH:mm形式
 * @param status 予約ステータス
 * @returns キャンセルタイミング
 */
export function getCancelTimingFromStrings(
  sessionDateStr: string,
  applicationDateStr: string,
  status: '予約済み' | 'キャンセル済み'
): CancelTiming {
  if (status !== 'キャンセル済み') {
    return 'none';
  }

  // 日付部分のみ抽出
  const sessionDate = new Date(sessionDateStr);
  const applicationDatePart = applicationDateStr.split(' ')[0] ?? applicationDateStr;
  const applicationDate = new Date(applicationDatePart);

  return getCancelTiming(sessionDate, applicationDate, status);
}

// ============================================================================
// 実施判定
// ============================================================================

/**
 * 実施済みかどうかを判定（データ保存時の基本判定）
 *
 * 実施条件:
 * - ステータス「予約済み」かつ「来店/来場」が「済み」
 * - または、詳細ステータスが「前日キャンセル」「当日キャンセル」
 */
export function isImplemented(
  status: '予約済み' | 'キャンセル済み',
  visitStatus: '済み' | 'なし',
  detailStatus?: string | null
): boolean {
  // 前日/当日キャンセルは実施扱い
  if (detailStatus === '前日キャンセル' || detailStatus === '当日キャンセル') {
    return true;
  }
  // 通常の実施判定
  return status === '予約済み' && visitStatus === '済み';
}

/**
 * 集計対象として「実施」にカウントするかどうかを判定
 *
 * 優先順位:
 * 1. 手動除外（isExcluded）→ 最優先で除外
 * 2. 手動実施設定（isImplementedManual）→ 手動設定があれば優先
 * 3. 実施判定ルール + CSV元データ（自動判定）
 *
 * @param reservation 予約レコード
 * @param implementationRule 実施判定ルール
 * @returns 実施としてカウントするならtrue
 */
export function shouldCountAsImplemented(
  reservation: ReservationHistory,
  implementationRule: ImplementationRule = 'includeLateCancel'
): boolean {
  // 1. 手動で除外されている場合は対象外（最優先）
  if (reservation.isExcluded) {
    return false;
  }

  // 2. 手動で実施/未実施が設定されている場合はその値を使用
  if (reservation.isImplementedManual !== null && reservation.isImplementedManual !== undefined) {
    return reservation.isImplementedManual;
  }

  // 3. 自動判定（実施判定ルール + CSV元データ）
  // 前日/当日キャンセルの扱い
  const isLateCancel = reservation.detailStatus === '前日キャンセル' || reservation.detailStatus === '当日キャンセル';

  if (isLateCancel) {
    // includeLateCancel: 前日/当日キャンセルも実施扱い
    // strict: 前日/当日キャンセルは実施扱いにしない
    return implementationRule === 'includeLateCancel';
  }

  // 通常の実施判定（来店実施）
  // status が「予約済み」かつ visitStatus が「済み」
  return reservation.status === '予約済み' && reservation.visitStatus === '済み';
}

// ============================================================================
// CSVマージロジック
// ============================================================================

/**
 * CSVレコードをReservationHistoryに変換
 */
export function csvToHistory(
  csv: CsvInputRecord,
  visitIndex: number,
  now: Date,
  existingIsExcluded: boolean = false,
  existingGroupId: string | null = null,
  existingIsImplementedManual: boolean | null = null
): ReservationHistory {
  const implemented = isImplemented(csv.status, csv.visitStatus, csv.detailStatus);

  return {
    reservationId: csv.reservationId,
    friendId: csv.friendId,
    name: csv.name,
    sessionDate: csv.sessionDate,
    applicationDate: csv.applicationDate,
    status: csv.status,
    visitStatus: csv.visitStatus,
    isImplemented: implemented,
    staff: csv.staff,
    detailStatus: csv.detailStatus,
    course: csv.course, // コース名
    reservationSlot: csv.reservationSlot, // 予約枠（G列）
    visitIndex: implemented ? visitIndex : 0,
    visitLabel: implemented ? getVisitLabel(visitIndex) : '初回',
    isExcluded: existingIsExcluded, // 既存の除外フラグを引き継ぐ
    isImplementedManual: existingIsImplementedManual, // 既存の手動実施フラグを引き継ぐ
    wasOmakase: csv.wasOmakase, // おまかせ予約フラグ
    groupId: existingGroupId, // 同日統合ID（既存を引き継ぐ）
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * CSVデータを履歴にマージ（重複排除、後勝ち）
 *
 * @param existingHistories 既存の履歴Map
 * @param existingUserCounts 既存のユーザーカウントMap
 * @param csvRecords 新しいCSVレコード
 * @returns 更新後の履歴MapとユーザーカウントMap
 */
export function mergeCsvToHistories(
  existingHistories: Map<string, ReservationHistory>,
  existingUserCounts: Map<string, UserVisitCount>,
  csvRecords: CsvInputRecord[]
): {
  histories: Map<string, ReservationHistory>;
  userCounts: Map<string, UserVisitCount>;
} {
  const now = new Date();

  // 作業用コピーを作成
  const histories = new Map(existingHistories);
  const userCounts = new Map(existingUserCounts);

  // 日付順にソート（古い順）
  const sortedRecords = [...csvRecords].sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());

  for (const csv of sortedRecords) {
    const existingHistory = histories.get(csv.reservationId);
    const implemented = isImplemented(csv.status, csv.visitStatus, csv.detailStatus);

    // ユーザーカウントを取得または初期化
    let userCount = userCounts.get(csv.friendId);
    if (!userCount) {
      userCount = {
        friendId: csv.friendId,
        implementationCount: 0,
        lastSessionDate: null,
        createdAt: now,
        updatedAt: now,
      };
    }

    // 既存レコードの実施状態を確認（上書き前）
    const wasImplemented = existingHistory?.isImplemented ?? false;

    // visitIndexを決定
    let visitIndex = 0;
    if (implemented) {
      if (wasImplemented) {
        // 既に実施済みだった場合は既存のvisitIndexを維持
        visitIndex = existingHistory!.visitIndex;
      } else {
        // 新たに実施になった場合はカウントを増やす
        userCount.implementationCount += 1;
        visitIndex = userCount.implementationCount;
        userCount.lastSessionDate = csv.sessionDate;
        userCount.updatedAt = now;
      }
    } else if (wasImplemented) {
      // 実施済み→未実施に変わった場合（キャンセルへの変更など）
      // カウントを減らす
      userCount.implementationCount = Math.max(0, userCount.implementationCount - 1);
      userCount.updatedAt = now;
    }

    // 履歴を作成/更新（既存のisExcluded, groupId, isImplementedManualを引き継ぐ）
    const existingIsExcluded = existingHistory?.isExcluded ?? false;
    const existingGroupId = existingHistory?.groupId ?? null;
    const existingIsImplementedManual = existingHistory?.isImplementedManual ?? null;
    const history = csvToHistory(
      csv,
      visitIndex,
      now,
      existingIsExcluded,
      existingGroupId,
      existingIsImplementedManual
    );
    if (existingHistory) {
      history.createdAt = existingHistory.createdAt; // 作成日は保持
    }

    histories.set(csv.reservationId, history);
    userCounts.set(csv.friendId, userCount);
  }

  return { histories, userCounts };
}

/**
 * 全履歴のvisitIndexを再計算
 * （ユーザーカウントも再構築）
 */
export function recalculateAllVisitIndexes(histories: Map<string, ReservationHistory>): {
  histories: Map<string, ReservationHistory>;
  userCounts: Map<string, UserVisitCount>;
} {
  const now = new Date();
  const newHistories = new Map<string, ReservationHistory>();
  const newUserCounts = new Map<string, UserVisitCount>();

  // 実施日順にソート
  const sortedHistories = Array.from(histories.values()).sort(
    (a, b) => a.sessionDate.getTime() - b.sessionDate.getTime()
  );

  for (const history of sortedHistories) {
    // ユーザーカウントを取得または初期化
    let userCount = newUserCounts.get(history.friendId);
    if (!userCount) {
      userCount = {
        friendId: history.friendId,
        implementationCount: 0,
        lastSessionDate: null,
        createdAt: now,
        updatedAt: now,
      };
    }

    // visitIndexを再計算
    let visitIndex = 0;
    if (history.isImplemented) {
      userCount.implementationCount += 1;
      visitIndex = userCount.implementationCount;
      userCount.lastSessionDate = history.sessionDate;
      userCount.updatedAt = now;
    }

    // 更新した履歴を保存
    newHistories.set(history.reservationId, {
      ...history,
      visitIndex,
      visitLabel: history.isImplemented ? getVisitLabel(visitIndex) : '初回',
      updatedAt: now,
    });

    newUserCounts.set(history.friendId, userCount);
  }

  return { histories: newHistories, userCounts: newUserCounts };
}

// ============================================================================
// 集計ロジック
// ============================================================================

/**
 * 期間内のレコードをフィルタ
 */
export function filterByPeriod(
  histories: Map<string, ReservationHistory>,
  periodFrom: Date,
  periodTo: Date,
  dateType: TargetDateType
): ReservationHistory[] {
  const results: ReservationHistory[] = [];

  // 期間の終了日は23:59:59までを含める
  const periodToEnd = new Date(periodTo);
  periodToEnd.setHours(23, 59, 59, 999);

  for (const history of histories.values()) {
    const targetDate = dateType === 'application' ? history.applicationDate : history.sessionDate;

    if (targetDate >= periodFrom && targetDate <= periodToEnd) {
      results.push(history);
    }
  }

  return results;
}

/**
 * キャンペーン条件でフィルタ
 */
export function filterByCampaign(
  histories: Map<string, ReservationHistory>,
  campaign: CampaignMaster
): ReservationHistory[] {
  return filterByPeriod(histories, campaign.targetPeriodFrom, campaign.targetPeriodTo, campaign.targetDateType);
}

/**
 * 同日複数予約を統合（同じ人が同日に複数予約している場合は1件としてカウント）
 *
 * 統合ルール:
 * - 同じfriendId + 同じsessionDate（日付）の予約をグループ化
 * - グループ内で実施済み（isImplemented=true）があれば、そのレコードを代表とする
 * - 複数の実施済みがある場合は最初の予約を代表とする
 * - 実施済みがない場合は最初の予約を代表とする
 *
 * @param records 対象レコード
 * @param merge trueの場合、同日予約を統合する
 */
export function applySameDayMerge(records: ReservationHistory[], merge: boolean): ReservationHistory[] {
  if (!merge) {
    // 統合しない場合はそのまま返す
    return records;
  }

  // friendId_sessionDate でグループ化
  const groups = new Map<string, ReservationHistory[]>();

  for (const record of records) {
    const key = `${record.friendId}_${formatDate(record.sessionDate)}`;
    const group = groups.get(key) || [];
    group.push(record);
    groups.set(key, group);
  }

  // 各グループから代表レコードを選択
  const results: ReservationHistory[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      // 1件のみならそのまま
      const first = group[0];
      if (first) results.push(first);
    } else {
      // 複数件ある場合、代表を選択
      // 優先順位: 実施済み > 未実施、同じ場合は申込日時が早い順
      const sorted = [...group].sort((a, b) => {
        // 実施済みを優先
        if (a.isImplemented && !b.isImplemented) return -1;
        if (!a.isImplemented && b.isImplemented) return 1;
        // 同じ場合は申込日時順
        return a.applicationDate.getTime() - b.applicationDate.getTime();
      });
      const first = sorted[0];
      if (first) results.push(first);
    }
  }

  return results;
}

/**
 * 集計サマリーを計算
 *
 * @param records 対象レコード
 * @param periodFrom 期間開始
 * @param periodTo 期間終了
 * @param dateType 日付タイプ
 * @param implementationRule 実施判定ルール
 */
export function calculateSummary(
  records: ReservationHistory[],
  periodFrom: Date,
  periodTo: Date,
  dateType: TargetDateType,
  implementationRule: ImplementationRule = 'includeLateCancel'
): AggregationSummary {
  let totalImplementations = 0;
  let totalCancellations = 0;
  let firstTimeCount = 0;
  let repeatCount = 0;

  for (const record of records) {
    // 除外されているレコードはスキップ
    if (record.isExcluded) {
      continue;
    }

    // 実施判定ルールに基づいてカウント
    if (shouldCountAsImplemented(record, implementationRule)) {
      totalImplementations++;
      if (record.visitIndex === 1) {
        firstTimeCount++;
      } else {
        repeatCount++;
      }
    } else if (record.status === 'キャンセル済み') {
      totalCancellations++;
    }
  }

  // 除外されていないレコードのみカウント
  const totalRecords = records.filter(r => !r.isExcluded).length;
  const implementationRate = totalRecords > 0 ? Math.round((totalImplementations / totalRecords) * 1000) / 10 : 0;
  const firstTimeRate = totalImplementations > 0 ? Math.round((firstTimeCount / totalImplementations) * 1000) / 10 : 0;

  return {
    periodFrom,
    periodTo,
    dateType,
    totalRecords,
    totalImplementations,
    totalCancellations,
    implementationRate,
    firstTimeCount,
    repeatCount,
    firstTimeRate,
  };
}

/**
 * 日別集計を計算
 *
 * @param records 対象レコード
 * @param dateType 日付タイプ
 * @param implementationRule 実施判定ルール
 */
export function calculateDailyAggregation(
  records: ReservationHistory[],
  dateType: TargetDateType,
  implementationRule: ImplementationRule = 'includeLateCancel'
): DailyAggregation[] {
  const dailyMap = new Map<string, DailyAggregation>();

  for (const record of records) {
    // 除外されているレコードはスキップ
    if (record.isExcluded) {
      continue;
    }

    const targetDate = dateType === 'application' ? record.applicationDate : record.sessionDate;
    const dateStr = formatDate(targetDate);

    let daily = dailyMap.get(dateStr);
    if (!daily) {
      daily = {
        date: dateStr,
        totalRecords: 0,
        implementations: 0,
        cancellations: 0,
        firstTimeCount: 0,
        repeatCount: 0,
      };
    }

    daily.totalRecords++;

    // 実施判定ルールに基づいてカウント
    if (shouldCountAsImplemented(record, implementationRule)) {
      daily.implementations++;
      if (record.visitIndex === 1) {
        daily.firstTimeCount++;
      } else {
        daily.repeatCount++;
      }
    } else if (record.status === 'キャンセル済み') {
      daily.cancellations++;
    }

    dailyMap.set(dateStr, daily);
  }

  // 日付順にソート
  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// 表示用変換
// ============================================================================

/**
 * 履歴をフラットレコードに変換
 */
export function historyToFlatRecord(history: ReservationHistory): FlatRecord {
  return {
    reservationId: history.reservationId,
    friendId: history.friendId,
    name: history.name,
    sessionDateStr: formatDate(history.sessionDate),
    applicationDateStr: formatDateTime(history.applicationDate),
    status: history.status,
    visitStatus: history.visitStatus,
    isImplemented: history.isImplemented,
    staff: history.staff,
    detailStatus: history.detailStatus,
    visitIndex: history.visitIndex,
    visitLabel: history.isImplemented ? history.visitLabel : '-',
    isExcluded: history.isExcluded,
    wasOmakase: history.wasOmakase,
    course: history.course,
    reservationSlot: history.reservationSlot,
  };
}

/**
 * 履歴Mapをフラットレコード配列に変換（日付降順）
 */
export function historiesToFlatRecords(histories: Map<string, ReservationHistory>): FlatRecord[] {
  return Array.from(histories.values())
    .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime())
    .map(historyToFlatRecord);
}

// ============================================================================
// CSV出力
// ============================================================================

/**
 * フラットレコードをCSV形式に変換
 */
export function flatRecordsToCSV(records: FlatRecord[]): string {
  const header = [
    '予約ID',
    '友だちID',
    '名前',
    '実施日',
    '申込日時',
    'ステータス',
    '来店/来場',
    '実施済み',
    '来店回数',
    '区分',
    '担当者',
    '詳細ステータス',
  ].join(',');

  const rows = records.map(record => {
    return [
      escapeCSV(record.reservationId),
      escapeCSV(record.friendId),
      escapeCSV(record.name),
      record.sessionDateStr,
      record.applicationDateStr,
      record.status,
      record.visitStatus,
      record.isImplemented ? 'はい' : 'いいえ',
      record.visitIndex > 0 ? record.visitIndex.toString() : '-',
      record.visitLabel,
      escapeCSV(record.staff || ''),
      escapeCSV(record.detailStatus || ''),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * CSV値のエスケープ
 */
function escapeCSV(value: string): string {
  if (!value) return '';

  // CSVインジェクション対策
  const DANGEROUS_CHARS = /^[=+\-@\t\r]/;
  let sanitized = value;

  if (DANGEROUS_CHARS.test(value)) {
    sanitized = "'" + value;
  }

  if (sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('"')) {
    sanitized = `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}
