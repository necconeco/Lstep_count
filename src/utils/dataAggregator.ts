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

/**
 * 実施判定
 * ステータスが「予約済み」かつ「来店/来場」が「済み」
 */
export function isImplemented(record: CsvRecord): boolean {
  return record.ステータス === '予約済み' && record['来店/来場'] === '済み';
}

/**
 * 実施ステータスの取得
 */
export function getImplementationStatus(record: CsvRecord): ImplementationStatus {
  if (record.ステータス === '予約済み' && record['来店/来場'] === '済み') {
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
 */
export function getVisitType(
  friendId: string,
  masterData: Map<string, UserHistoryMaster>
): VisitType {
  const master = masterData.get(friendId);

  if (!master || master.implementationCount === 0) {
    return '初回';
  } else if (master.implementationCount === 1) {
    return '2回目';
  } else {
    return '3回目以降';
  }
}

/**
 * 履歴マスタを更新
 * 実施済みレコードの場合、カウントを増やす
 */
export function updateMasterData(
  csvData: CsvRecord[],
  currentMasterData: Map<string, UserHistoryMaster>
): Map<string, UserHistoryMaster> {
  const newMasterData = new Map(currentMasterData);
  const now = new Date();

  csvData.forEach((record) => {
    if (isImplemented(record)) {
      const friendId = record.友だちID;
      const implementationDate = new Date(record.予約日);
      const existing = newMasterData.get(friendId);

      if (existing) {
        newMasterData.set(friendId, {
          ...existing,
          implementationCount: existing.implementationCount + 1,
          lastImplementationDate: implementationDate,
          updatedAt: now,
        });
      } else {
        newMasterData.set(friendId, {
          friendId,
          implementationCount: 1,
          lastImplementationDate: implementationDate,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  });

  return newMasterData;
}

/**
 * サマリー集計
 */
export function aggregateSummary(
  csvData: CsvRecord[],
  masterData: Map<string, UserHistoryMaster>
): AggregationSummary {
  let totalApplications = 0;
  let totalImplementations = 0;
  let totalCancellations = 0;
  let firstTimeApplications = 0;
  let firstTimeImplementations = 0;
  let repeatApplications = 0;
  let repeatImplementations = 0;

  csvData.forEach((record) => {
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

  const implementationRate =
    totalApplications > 0 ? (totalImplementations / totalApplications) * 100 : 0;
  const firstTimeApplicationRate =
    totalApplications > 0 ? (firstTimeApplications / totalApplications) * 100 : 0;
  const firstTimeImplementationRate =
    firstTimeApplications > 0 ? (firstTimeImplementations / firstTimeApplications) * 100 : 0;
  const repeatApplicationRate =
    totalApplications > 0 ? (repeatApplications / totalApplications) * 100 : 0;
  const repeatImplementationRate =
    repeatApplications > 0 ? (repeatImplementations / repeatApplications) * 100 : 0;

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
export function aggregateByStaff(
  csvData: CsvRecord[],
  masterData: Map<string, UserHistoryMaster>
): StaffResult[] {
  const staffMap = new Map<string, StaffResult>();

  csvData.forEach((record) => {
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
  staffMap.forEach((staff) => {
    staff.implementationRate =
      staff.applications > 0 ? (staff.implementations / staff.applications) * 100 : 0;
    results.push(staff);
  });

  // 申込数でソート（降順）
  return results.sort((a, b) => b.applications - a.applications);
}

/**
 * 日別集計
 */
export function aggregateByDate(
  csvData: CsvRecord[],
  masterData: Map<string, UserHistoryMaster>
): DailyResult[] {
  const dateMap = new Map<string, DailyResult>();

  csvData.forEach((record) => {
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
export function aggregateByMonth(
  csvData: CsvRecord[],
  _masterData: Map<string, UserHistoryMaster>
): MonthlyResult[] {
  const monthMap = new Map<string, MonthlyResult>();

  csvData.forEach((record) => {
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
  monthMap.forEach((monthly) => {
    monthly.implementationRate =
      monthly.applications > 0 ? (monthly.implementations / monthly.applications) * 100 : 0;
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
 * 全集計処理を実行
 */
export function aggregateAll(
  csvData: CsvRecord[],
  masterData: Map<string, UserHistoryMaster>
) {
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
