/**
 * Domain層 - マスターデータマージ・重複排除の純粋関数
 * 「後勝ち」マージルール、visitIndex再計算
 */

import type {
  VisitType,
  FullHistoryRecord,
  FullHistoryMaster,
  ImplementationMaster,
  ImplementationHistoryRecord,
  MasterCsvInputRecord,
  FlattenedRecord,
  MasterDataSummary,
} from './types';

// ============================================================================
// ユーティリティ関数
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
 * 来店回数からVisitLabelを取得
 */
export function getVisitLabel(visitIndex: number): VisitType {
  if (visitIndex === 1) return '初回';
  if (visitIndex === 2) return '2回目';
  return '3回目以降';
}

/**
 * 実施判定
 */
export function isImplemented(
  status: '予約済み' | 'キャンセル済み',
  visitStatus: '済み' | 'なし',
  detailStatus?: string | null
): boolean {
  // 前日キャンセル・当日キャンセルは実施扱い
  if (detailStatus === '前日キャンセル' || detailStatus === '当日キャンセル') {
    return true;
  }
  // ステータス「予約済み」かつ「来店/来場」が「済み」
  return status === '予約済み' && visitStatus === '済み';
}

/**
 * フォールバックキーを生成（重複判定用）
 * reservationIdがない場合のフォールバック: friendId + date + applicationDate
 */
export function generateFallbackKey(friendId: string, date: Date, applicationDate: string): string {
  return `${friendId}_${formatDate(date)}_${applicationDate}`;
}

/**
 * レコードの一意キーを取得（reservationId優先、なければfallbackKey）
 */
export function getRecordKey(record: { reservationId: string; fallbackKey?: string }): string {
  if (record.reservationId && record.reservationId.trim() !== '') {
    return `rid:${record.reservationId}`;
  }
  return `fb:${record.fallbackKey || 'unknown'}`;
}

// ============================================================================
// マージ処理（純粋関数）
// ============================================================================

/**
 * CSVレコードをFullHistoryRecordに変換
 */
export function csvToFullHistoryRecord(csv: MasterCsvInputRecord, visitIndex: number = 0): FullHistoryRecord {
  const implemented = isImplemented(csv.status, csv.visitStatus, csv.detailStatus);

  return {
    reservationId: csv.reservationId,
    friendId: csv.friendId,
    date: csv.date,
    status: csv.status,
    visitStatus: csv.visitStatus,
    isImplemented: implemented,
    name: csv.name,
    staff: csv.staff,
    detailStatus: csv.detailStatus,
    applicationDate: csv.applicationDate,
    visitIndex: implemented ? visitIndex : 0,
    visitLabel: implemented && visitIndex > 0 ? getVisitLabel(visitIndex) : '初回',
    fallbackKey: generateFallbackKey(csv.friendId, csv.date, csv.applicationDate),
  };
}

/**
 * 既存のフル履歴に新しいCSVレコードをマージ（後勝ち）
 * @param existingRecords - 既存の履歴レコード
 * @param newRecords - 新しいCSVレコード
 * @returns マージ後のレコード（日付順）
 */
export function mergeFullHistoryRecords(
  existingRecords: FullHistoryRecord[],
  newRecords: MasterCsvInputRecord[]
): FullHistoryRecord[] {
  // 既存レコードをMapに格納（キー: reservationId or fallbackKey）
  const recordMap = new Map<string, FullHistoryRecord>();

  for (const record of existingRecords) {
    const key = getRecordKey(record);
    recordMap.set(key, record);
  }

  // 新しいレコードで上書き（後勝ち）
  for (const csv of newRecords) {
    const tempRecord = csvToFullHistoryRecord(csv, 0); // visitIndexは後で再計算
    const key = getRecordKey(tempRecord);
    recordMap.set(key, tempRecord);
  }

  // 日付順にソート
  const mergedRecords = Array.from(recordMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

  // visitIndex を再計算
  return recalculateVisitIndex(mergedRecords);
}

/**
 * visitIndex を再計算（実施済みレコードのみにインデックス付与）
 */
export function recalculateVisitIndex(records: FullHistoryRecord[]): FullHistoryRecord[] {
  let implementationIndex = 0;

  return records.map(record => {
    if (record.isImplemented) {
      implementationIndex++;
      return {
        ...record,
        visitIndex: implementationIndex,
        visitLabel: getVisitLabel(implementationIndex),
      };
    } else {
      return {
        ...record,
        visitIndex: 0,
        visitLabel: '初回', // 未実施の場合は便宜上「初回」
      };
    }
  });
}

// ============================================================================
// マスターデータ生成（純粋関数）
// ============================================================================

/**
 * フル履歴マスターを生成/更新
 * @param existingMaster - 既存のマスター（なければnull）
 * @param csvRecords - 新しいCSVレコード
 * @returns 更新されたフル履歴マスター
 */
export function updateFullHistoryMaster(
  existingMaster: FullHistoryMaster | null,
  csvRecords: MasterCsvInputRecord[]
): FullHistoryMaster {
  const now = new Date();
  const friendId = csvRecords[0]?.friendId || existingMaster?.friendId || '';

  // 既存レコードとマージ
  const existingRecords = existingMaster?.records || [];
  const mergedRecords = mergeFullHistoryRecords(existingRecords, csvRecords);

  // 実施済みレコードを抽出
  const implementedRecords = mergedRecords.filter(r => r.isImplemented);
  const lastImplemented = implementedRecords[implementedRecords.length - 1] || null;

  return {
    friendId,
    records: mergedRecords,
    totalRecordCount: mergedRecords.length,
    implementationCount: implementedRecords.length,
    lastImplementationDate: lastImplemented?.date || null,
    lastStaff: lastImplemented?.staff || existingMaster?.lastStaff || null,
    createdAt: existingMaster?.createdAt || now,
    updatedAt: now,
  };
}

/**
 * 実施マスターを生成/更新
 * @param existingMaster - 既存のマスター（なければnull）
 * @param fullHistoryMaster - フル履歴マスター（実施レコード抽出元）
 * @returns 更新された実施マスター
 */
export function updateImplementationMaster(
  existingMaster: ImplementationMaster | null,
  fullHistoryMaster: FullHistoryMaster
): ImplementationMaster {
  const now = new Date();

  // フル履歴から実施済みレコードのみ抽出
  const implementedRecords: ImplementationHistoryRecord[] = fullHistoryMaster.records
    .filter(r => r.isImplemented)
    .map(r => ({
      reservationId: r.reservationId,
      friendId: r.friendId,
      date: r.date,
      staff: r.staff,
      visitIndex: r.visitIndex,
      visitLabel: r.visitLabel,
    }));

  const lastRecord = implementedRecords[implementedRecords.length - 1] || null;

  return {
    friendId: fullHistoryMaster.friendId,
    records: implementedRecords,
    implementationCount: implementedRecords.length,
    lastImplementationDate: lastRecord?.date || null,
    lastStaff: lastRecord?.staff || existingMaster?.lastStaff || null,
    createdAt: existingMaster?.createdAt || now,
    updatedAt: now,
  };
}

// ============================================================================
// バッチマージ処理（純粋関数）
// ============================================================================

/**
 * 複数ユーザーのCSVレコードをフル履歴マスターにバッチマージ
 * @param existingMasters - 既存のフル履歴マスター（Map）
 * @param csvRecords - 新しいCSVレコード（全ユーザー分）
 * @returns 更新されたフル履歴マスター（Map）
 */
export function batchMergeFullHistoryMasters(
  existingMasters: Map<string, FullHistoryMaster>,
  csvRecords: MasterCsvInputRecord[]
): Map<string, FullHistoryMaster> {
  // friendIdでグループ化
  const recordsByFriend = new Map<string, MasterCsvInputRecord[]>();

  for (const record of csvRecords) {
    const existing = recordsByFriend.get(record.friendId) || [];
    existing.push(record);
    recordsByFriend.set(record.friendId, existing);
  }

  // 各友だちのマスターを更新
  const updatedMasters = new Map<string, FullHistoryMaster>(existingMasters);

  for (const [friendId, records] of recordsByFriend) {
    const existingMaster = existingMasters.get(friendId) || null;
    const updatedMaster = updateFullHistoryMaster(existingMaster, records);
    updatedMasters.set(friendId, updatedMaster);
  }

  return updatedMasters;
}

/**
 * フル履歴マスターから実施マスターを生成
 * @param fullHistoryMasters - フル履歴マスター（Map）
 * @returns 実施マスター（Map）
 */
export function deriveImplementationMasters(
  fullHistoryMasters: Map<string, FullHistoryMaster>,
  existingImplMasters: Map<string, ImplementationMaster> = new Map()
): Map<string, ImplementationMaster> {
  const implMasters = new Map<string, ImplementationMaster>();

  for (const [friendId, fullMaster] of fullHistoryMasters) {
    const existingImpl = existingImplMasters.get(friendId) || null;
    const implMaster = updateImplementationMaster(existingImpl, fullMaster);
    implMasters.set(friendId, implMaster);
  }

  return implMasters;
}

// ============================================================================
// フラット化・統計（純粋関数）
// ============================================================================

/**
 * フル履歴マスターをフラットなレコード配列に変換
 * @param masters - フル履歴マスター（Map）
 * @returns フラット化されたレコード配列（日付降順）
 */
export function flattenFullHistoryMasters(masters: Map<string, FullHistoryMaster>): FlattenedRecord[] {
  const flattened: FlattenedRecord[] = [];

  for (const [, master] of masters) {
    for (const record of master.records) {
      flattened.push({
        reservationId: record.reservationId,
        friendId: record.friendId,
        date: record.date,
        dateString: formatDate(record.date),
        status: record.status,
        visitStatus: record.visitStatus,
        isImplemented: record.isImplemented,
        name: record.name,
        staff: record.staff,
        detailStatus: record.detailStatus,
        visitIndex: record.visitIndex,
        visitLabel: record.isImplemented ? record.visitLabel : '-',
      });
    }
  }

  // 日付降順でソート
  flattened.sort((a, b) => b.date.getTime() - a.date.getTime());

  return flattened;
}

/**
 * マスターデータの統計サマリーを生成
 */
export function getMasterDataSummary(fullHistoryMasters: Map<string, FullHistoryMaster>): MasterDataSummary {
  let totalRecords = 0;
  let implementationCount = 0;
  let cancellationCount = 0;
  let pendingCount = 0;
  let firstTimeCount = 0;
  let repeatCount = 0;

  for (const [, master] of fullHistoryMasters) {
    for (const record of master.records) {
      totalRecords++;

      if (record.status === 'キャンセル済み') {
        cancellationCount++;
      } else if (record.isImplemented) {
        implementationCount++;
        if (record.visitIndex === 1) {
          firstTimeCount++;
        } else {
          repeatCount++;
        }
      } else {
        pendingCount++;
      }
    }
  }

  return {
    totalUsers: fullHistoryMasters.size,
    totalRecords,
    implementationCount,
    cancellationCount,
    pendingCount,
    firstTimeCount,
    repeatCount,
  };
}

// ============================================================================
// CSV出力（純粋関数）
// ============================================================================

/**
 * フラット化されたレコードをCSV形式に変換
 */
export function flattenedRecordsToCSV(records: FlattenedRecord[]): string {
  const header = [
    '友だちID',
    '予約ID',
    '名前',
    '予約日',
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
      escapeCSVValue(record.friendId),
      escapeCSVValue(record.reservationId),
      escapeCSVValue(record.name),
      record.dateString,
      record.status,
      record.visitStatus,
      record.isImplemented ? 'はい' : 'いいえ',
      record.visitIndex > 0 ? record.visitIndex.toString() : '-',
      record.visitLabel,
      escapeCSVValue(record.staff || ''),
      escapeCSVValue(record.detailStatus || ''),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * CSV値のエスケープ処理
 */
function escapeCSVValue(value: string): string {
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
