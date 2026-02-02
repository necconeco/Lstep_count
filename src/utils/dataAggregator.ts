/**
 * データ集計ロジック
 */
import type {
  CsvRecord,
  UserHistoryMaster,
  AggregationSummary,
  StaffResult,
  DailyResult,
  MonthlyResult,
  SpreadsheetOutputData,
  VisitType,
  ImplementationStatus,
} from '../types';
import { parseLocalDate } from '../domain';

/**
 * 実施判定
 * 以下の条件を満たす場合に実施扱いとする：
 * 1. ステータス：予約済み + 来店/来場：済み
 * 2. ステータス：キャンセル済み + 詳細ステータス：前日 or 当日
 *    → 来店扱い（実施としてカウント）
 */
export function isImplemented(record: CsvRecord): boolean {
  const status = record.ステータス;
  const visit = record['来店/来場'];
  const detailStatus = record.詳細ステータス;

  // パターン1: 予約済み + 来店済み
  if (status === '予約済み' && visit === '済み') {
    return true;
  }

  // パターン2: キャンセル済み + 詳細ステータスが「前日キャンセル」or「当日キャンセル」
  // ユーザーがUI上で手動マーキングしたレコードのみ実施扱い
  if (status === 'キャンセル済み' && detailStatus) {
    if (detailStatus === '前日キャンセル' || detailStatus === '当日キャンセル') {
      return true;
    }
  }

  return false;
}

/**
 * 実施ステータスの取得
 * isImplemented 関数と同じロジックで判定
 */
export function getImplementationStatus(record: CsvRecord): ImplementationStatus {
  if (isImplemented(record)) {
    return '実施済み';
  } else if (record.ステータス === 'キャンセル済み') {
    return 'キャンセル済み';
  } else {
    return '予約中';
  }
}

/**
 * 初回/2回目判定
 * 履歴マスタを参照して判定
 * 実施履歴配列の長さで正確に判定
 */
export function getVisitType(friendId: string, masterData: Map<string, UserHistoryMaster>): VisitType {
  const master = masterData.get(friendId);

  if (!master || master.implementationHistory.length === 0) {
    return '初回';
  } else if (master.implementationHistory.length === 1) {
    return '2回目';
  } else {
    return '3回目以降';
  }
}

/**
 * 履歴マスタを更新
 * 全予約履歴（allHistory）を保持し、実施済みのみを implementationHistory に追加
 */
export function updateMasterData(
  csvData: CsvRecord[],
  currentMasterData: Map<string, UserHistoryMaster>
): Map<string, UserHistoryMaster> {
  const newMasterData = new Map(currentMasterData);
  const now = new Date();

  csvData.forEach(record => {
    const friendId = record.友だちID;
    const reservationDate = parseLocalDate(record.予約日);
    const staffName = record.担当者 || null;
    const implemented = isImplemented(record);
    const existing = newMasterData.get(friendId);

    // 全予約レコードを作成
    const reservationRecord = {
      date: reservationDate,
      reservationId: record.予約ID,
      status: record.ステータス,
      visitStatus: record['来店/来場'],
      isImplemented: implemented,
      staff: staffName || undefined,
      detailStatus: record.詳細ステータス,
    };

    if (existing) {
      // 重複チェック: 同じ予約IDが既に存在する場合は追加しない
      const alreadyExistsInAll = existing.allHistory.some(h => h.reservationId === record.予約ID);

      if (!alreadyExistsInAll) {
        // 全予約履歴に追加
        const newAllHistory = [...existing.allHistory, reservationRecord];
        newAllHistory.sort((a, b) => a.date.getTime() - b.date.getTime());

        // 実施履歴の更新（実施済みの場合のみ）
        let newImplementationHistory = existing.implementationHistory;
        if (implemented) {
          const alreadyExistsInImpl = existing.implementationHistory.some(h => h.reservationId === record.予約ID);

          if (!alreadyExistsInImpl) {
            newImplementationHistory = [
              ...existing.implementationHistory,
              {
                date: reservationDate,
                reservationId: record.予約ID,
                status: record.ステータス,
                staff: staffName || undefined,
              },
            ];
            newImplementationHistory.sort((a, b) => a.date.getTime() - b.date.getTime());
          }
        }

        // lastStaffを更新（実施済みの場合のみ）
        const updatedLastStaff = implemented && staffName ? staffName : existing.lastStaff;

        newMasterData.set(friendId, {
          ...existing,
          allHistory: newAllHistory,
          implementationHistory: newImplementationHistory,
          implementationCount: newImplementationHistory.length,
          lastImplementationDate: implemented ? reservationDate : existing.lastImplementationDate,
          lastStaff: updatedLastStaff,
          updatedAt: now,
        });
      }
    } else {
      // 新規作成
      const implementationHistory = implemented
        ? [
            {
              date: reservationDate,
              reservationId: record.予約ID,
              status: record.ステータス,
              staff: staffName || undefined,
            },
          ]
        : [];

      newMasterData.set(friendId, {
        friendId,
        allHistory: [reservationRecord],
        implementationHistory,
        implementationCount: implementationHistory.length,
        lastImplementationDate: implemented ? reservationDate : null,
        lastStaff: implemented && staffName ? staffName : null,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  return newMasterData;
}

/**
 * サマリー集計
 */
export function aggregateSummary(csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>): AggregationSummary {
  let totalApplications = 0;
  let totalImplementations = 0;
  let totalCancellations = 0;
  let firstTimeApplications = 0;
  let firstTimeImplementations = 0;
  let repeatApplications = 0;
  let repeatImplementations = 0;

  csvData.forEach(record => {
    totalApplications++;

    const visitType = getVisitType(record.友だちID, masterData);
    const implemented = isImplemented(record);
    const cancelled = record.ステータス === 'キャンセル済み';

    if (implemented) {
      totalImplementations++;
    }

    if (cancelled) {
      totalCancellations++;
    }

    // 初回 vs 2回目以降
    if (visitType === '初回') {
      firstTimeApplications++;
      if (implemented) {
        firstTimeImplementations++;
      }
    } else {
      // 2回目以降（2回目 + 3回目以降）
      repeatApplications++;
      if (implemented) {
        repeatImplementations++;
      }
    }
  });

  const implementationRate = totalApplications > 0 ? (totalImplementations / totalApplications) * 100 : 0;
  const firstTimeApplicationRate = totalApplications > 0 ? (firstTimeApplications / totalApplications) * 100 : 0;
  const firstTimeImplementationRate =
    firstTimeApplications > 0 ? (firstTimeImplementations / firstTimeApplications) * 100 : 0;
  const repeatApplicationRate = totalApplications > 0 ? (repeatApplications / totalApplications) * 100 : 0;
  const repeatImplementationRate = repeatApplications > 0 ? (repeatImplementations / repeatApplications) * 100 : 0;

  return {
    totalApplications,
    totalImplementations,
    totalCancellations,
    implementationRate,
    firstTimeApplications,
    firstTimeApplicationRate,
    firstTimeImplementations,
    firstTimeImplementationRate,
    repeatApplications,
    repeatApplicationRate,
    repeatImplementations,
    repeatImplementationRate,
  };
}

/**
 * 相談員別実績集計
 */
export function aggregateByStaff(csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>): StaffResult[] {
  const staffMap = new Map<string, StaffResult>();

  csvData.forEach(record => {
    const staffName = record.担当者 || '未設定';
    const visitType = getVisitType(record.友だちID, masterData);
    const implemented = isImplemented(record);
    const cancelled = record.ステータス === 'キャンセル済み';

    if (!staffMap.has(staffName)) {
      staffMap.set(staffName, {
        staffName,
        applications: 0,
        implementations: 0,
        cancellations: 0,
        implementationRate: 0,
        firstTimeCount: 0,
        repeatCount: 0,
      });
    }

    const staff = staffMap.get(staffName)!;
    staff.applications++;

    if (implemented) {
      staff.implementations++;
    }

    if (cancelled) {
      staff.cancellations++;
    }

    if (visitType === '初回') {
      staff.firstTimeCount++;
    } else {
      staff.repeatCount++;
    }
  });

  // 実施率を計算
  const results: StaffResult[] = [];
  staffMap.forEach(staff => {
    staff.implementationRate = staff.applications > 0 ? (staff.implementations / staff.applications) * 100 : 0;
    results.push(staff);
  });

  // 申込数でソート（降順）
  return results.sort((a, b) => b.applications - a.applications);
}

/**
 * 日別集計
 */
export function aggregateByDate(csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>): DailyResult[] {
  const dateMap = new Map<string, DailyResult>();

  csvData.forEach(record => {
    const date = record.予約日;
    const visitType = getVisitType(record.友だちID, masterData);
    const implemented = isImplemented(record);
    const cancelled = record.ステータス === 'キャンセル済み';

    if (!dateMap.has(date)) {
      dateMap.set(date, {
        date,
        applications: 0,
        implementations: 0,
        cancellations: 0,
        firstTimeCount: 0,
        repeatCount: 0,
      });
    }

    const daily = dateMap.get(date)!;
    daily.applications++;

    if (implemented) {
      daily.implementations++;
    }

    if (cancelled) {
      daily.cancellations++;
    }

    if (visitType === '初回') {
      daily.firstTimeCount++;
    } else {
      daily.repeatCount++;
    }
  });

  // 日付でソート（昇順）
  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 月別集計
 */
export function aggregateByMonth(csvData: CsvRecord[], _masterData: Map<string, UserHistoryMaster>): MonthlyResult[] {
  const monthMap = new Map<string, MonthlyResult>();

  csvData.forEach(record => {
    const month = record.予約日.substring(0, 7); // YYYY-MM
    const implemented = isImplemented(record);
    const cancelled = record.ステータス === 'キャンセル済み';

    if (!monthMap.has(month)) {
      monthMap.set(month, {
        month,
        applications: 0,
        implementations: 0,
        cancellations: 0,
        implementationRate: 0,
      });
    }

    const monthly = monthMap.get(month)!;
    monthly.applications++;

    if (implemented) {
      monthly.implementations++;
    }

    if (cancelled) {
      monthly.cancellations++;
    }
  });

  // 実施率を計算してソート
  const results: MonthlyResult[] = [];
  monthMap.forEach(monthly => {
    monthly.implementationRate = monthly.applications > 0 ? (monthly.implementations / monthly.applications) * 100 : 0;
    results.push(monthly);
  });

  return results.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * スプレッドシート出力データ生成（AB~AM列）
 */
export function generateSpreadsheetData(summary: AggregationSummary): SpreadsheetOutputData {
  return {
    AB: summary.firstTimeApplications, // 初回予約合計
    AC: Math.round(summary.firstTimeApplicationRate * 10) / 10, // 初回予約率(%)
    AD: summary.firstTimeImplementations, // 初回実施合計
    AE: Math.round(summary.firstTimeImplementationRate * 10) / 10, // 初回実施率(%)
    AJ: summary.repeatApplications, // 2回目以降予約合計
    AK: Math.round(summary.repeatApplicationRate * 10) / 10, // 2回目以降予約率(%)
    AL: summary.repeatImplementations, // 2回目以降実施合計
    AM: Math.round(summary.repeatImplementationRate * 10) / 10, // 2回目以降実施率(%)
  };
}

/**
 * キャリア相談のご利用回数フィールドの自動補完
 * 空欄の場合、マスタデータを基に「初めて」または「2回目以上」を自動設定
 */
export function autoPopulateUsageCount(csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>): CsvRecord[] {
  const usageCountField = 'キャリア相談のご利用回数を教えてください。';

  return csvData.map(record => {
    // 既に値が入っている場合はそのまま
    const usageValue = record[usageCountField];
    if (typeof usageValue === 'string' && usageValue.trim() !== '') {
      return record;
    }

    // 空欄の場合、自動判定を挿入
    const visitType = getVisitType(record.友だちID, masterData);
    const autoValue = visitType === '初回' ? '初めて' : '2回目以上';

    return {
      ...record,
      [usageCountField]: autoValue,
    };
  });
}

/**
 * 全集計処理を実行
 */
export function aggregateAll(csvData: CsvRecord[], masterData: Map<string, UserHistoryMaster>) {
  const summary = aggregateSummary(csvData, masterData);
  const staffResults = aggregateByStaff(csvData, masterData);
  const dailyResults = aggregateByDate(csvData, masterData);
  const monthlyResults = aggregateByMonth(csvData, masterData);
  const spreadsheetData = generateSpreadsheetData(summary);

  return {
    summary,
    staffResults,
    dailyResults,
    monthlyResults,
    spreadsheetData,
  };
}
