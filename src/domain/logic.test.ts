/**
 * domain/logic.ts ユニットテスト
 * ビジネスロジックの純粋関数をテスト
 */
import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  getVisitLabel,
  getCancelTiming,
  getCancelTimingFromStrings,
  isImplemented,
  shouldCountAsImplemented,
  csvToHistory,
  mergeCsvToHistories,
  recalculateAllVisitIndexes,
  filterByPeriod,
  calculateSummary,
  calculateDailyAggregation,
  historyToFlatRecord,
  historiesToFlatRecords,
  flatRecordsToCSV,
} from './logic';
import type { ReservationHistory, CsvInputRecord, UserVisitCount } from './types';

describe('domain/logic', () => {
  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2024-12-01T10:30:00');
      expect(formatDate(date)).toBe('2024-12-01');
    });

    it('should pad single digit month and day', () => {
      const date = new Date('2024-01-05T00:00:00');
      expect(formatDate(date)).toBe('2024-01-05');
    });
  });

  describe('formatDateTime', () => {
    it('should format datetime as YYYY-MM-DD HH:mm', () => {
      const date = new Date('2024-12-01T10:30:00');
      expect(formatDateTime(date)).toBe('2024-12-01 10:30');
    });

    it('should pad single digit hours and minutes', () => {
      const date = new Date('2024-12-01T05:03:00');
      expect(formatDateTime(date)).toBe('2024-12-01 05:03');
    });
  });

  describe('getVisitLabel', () => {
    it('should return 初回 for visitIndex 1', () => {
      expect(getVisitLabel(1)).toBe('初回');
    });

    it('should return 2回目 for visitIndex 2', () => {
      expect(getVisitLabel(2)).toBe('2回目');
    });

    it('should return 3回目以降 for visitIndex 3 or more', () => {
      expect(getVisitLabel(3)).toBe('3回目以降');
      expect(getVisitLabel(10)).toBe('3回目以降');
    });
  });

  describe('getCancelTiming', () => {
    it('should return none for non-cancelled status', () => {
      const sessionDate = new Date('2024-12-05');
      const applicationDate = new Date('2024-12-01');
      expect(getCancelTiming(sessionDate, applicationDate, '予約済み')).toBe('none');
    });

    it('should return same-day for same day cancellation', () => {
      const sessionDate = new Date('2024-12-05');
      const applicationDate = new Date('2024-12-05');
      expect(getCancelTiming(sessionDate, applicationDate, 'キャンセル済み')).toBe('same-day');
    });

    it('should return previous-day for 1 day before cancellation', () => {
      const sessionDate = new Date('2024-12-05');
      const applicationDate = new Date('2024-12-04');
      expect(getCancelTiming(sessionDate, applicationDate, 'キャンセル済み')).toBe('previous-day');
    });

    it('should return early for more than 1 day before', () => {
      const sessionDate = new Date('2024-12-05');
      const applicationDate = new Date('2024-12-01');
      expect(getCancelTiming(sessionDate, applicationDate, 'キャンセル済み')).toBe('early');
    });
  });

  describe('getCancelTimingFromStrings', () => {
    it('should work with string dates', () => {
      expect(getCancelTimingFromStrings('2024-12-05', '2024-12-05 10:00', 'キャンセル済み')).toBe('same-day');
      expect(getCancelTimingFromStrings('2024-12-05', '2024-12-04 15:30', 'キャンセル済み')).toBe('previous-day');
      expect(getCancelTimingFromStrings('2024-12-05', '2024-12-01 09:00', 'キャンセル済み')).toBe('early');
    });

    it('should return none for non-cancelled', () => {
      expect(getCancelTimingFromStrings('2024-12-05', '2024-12-01 09:00', '予約済み')).toBe('none');
    });
  });

  describe('isImplemented', () => {
    it('should return true for 予約済み with 済み visit', () => {
      expect(isImplemented('予約済み', '済み')).toBe(true);
    });

    it('should return false for 予約済み with なし visit', () => {
      expect(isImplemented('予約済み', 'なし')).toBe(false);
    });

    it('should return false for キャンセル済み with 済み visit', () => {
      expect(isImplemented('キャンセル済み', '済み')).toBe(false);
    });

    it('should return true for 前日キャンセル detailStatus', () => {
      expect(isImplemented('キャンセル済み', 'なし', '前日キャンセル')).toBe(true);
    });

    it('should return true for 当日キャンセル detailStatus', () => {
      expect(isImplemented('キャンセル済み', 'なし', '当日キャンセル')).toBe(true);
    });
  });

  describe('shouldCountAsImplemented', () => {
    const baseHistory: ReservationHistory = {
      reservationId: 'R001',
      friendId: 'F001',
      name: 'テスト太郎',
      sessionDate: new Date('2024-12-01'),
      applicationDate: new Date('2024-11-25'),
      status: '予約済み',
      visitStatus: '済み',
      isImplemented: true,
      staff: null,
      detailStatus: null,
      visitIndex: 1,
      visitLabel: '初回',
      isExcluded: false,
      wasOmakase: false,
      groupId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return true for implemented record', () => {
      expect(shouldCountAsImplemented(baseHistory)).toBe(true);
    });

    it('should return false for excluded record', () => {
      const excluded = { ...baseHistory, isExcluded: true };
      expect(shouldCountAsImplemented(excluded)).toBe(false);
    });

    it('should return true for late cancel with includeLateCancel rule', () => {
      const lateCancel: ReservationHistory = {
        ...baseHistory,
        status: 'キャンセル済み',
        visitStatus: 'なし',
        isImplemented: false,
        detailStatus: '前日キャンセル',
      };
      expect(shouldCountAsImplemented(lateCancel, 'includeLateCancel')).toBe(true);
    });

    it('should return false for late cancel with strict rule', () => {
      const lateCancel: ReservationHistory = {
        ...baseHistory,
        status: 'キャンセル済み',
        visitStatus: 'なし',
        isImplemented: false,
        detailStatus: '当日キャンセル',
      };
      expect(shouldCountAsImplemented(lateCancel, 'strict')).toBe(false);
    });
  });

  describe('csvToHistory', () => {
    const baseCsvRecord: CsvInputRecord = {
      reservationId: 'R001',
      friendId: 'F001',
      name: 'テスト太郎',
      sessionDate: new Date('2024-12-01'),
      applicationDate: new Date('2024-11-25'),
      status: '予約済み',
      visitStatus: '済み',
      staff: '担当者A',
      detailStatus: null,
      wasOmakase: false,
    };

    it('should convert CSV record to history', () => {
      const now = new Date();
      const history = csvToHistory(baseCsvRecord, 1, now);

      expect(history.reservationId).toBe('R001');
      expect(history.friendId).toBe('F001');
      expect(history.isImplemented).toBe(true);
      expect(history.visitIndex).toBe(1);
      expect(history.visitLabel).toBe('初回');
    });

    it('should set visitIndex to 0 for non-implemented', () => {
      const notImplemented: CsvInputRecord = {
        ...baseCsvRecord,
        visitStatus: 'なし',
      };
      const history = csvToHistory(notImplemented, 1, new Date());
      expect(history.visitIndex).toBe(0);
    });

    it('should preserve existing isExcluded and groupId', () => {
      const history = csvToHistory(baseCsvRecord, 1, new Date(), true, 'group-123');
      expect(history.isExcluded).toBe(true);
      expect(history.groupId).toBe('group-123');
    });
  });

  describe('mergeCsvToHistories', () => {
    it('should merge new CSV records to empty histories', () => {
      const csvRecords: CsvInputRecord[] = [
        {
          reservationId: 'R001',
          friendId: 'F001',
          name: 'テスト太郎',
          sessionDate: new Date('2024-12-01'),
          applicationDate: new Date('2024-11-25'),
          status: '予約済み',
          visitStatus: '済み',
          staff: null,
          detailStatus: null,
          wasOmakase: false,
        },
      ];

      const result = mergeCsvToHistories(new Map(), new Map(), csvRecords);

      expect(result.histories.size).toBe(1);
      expect(result.userCounts.size).toBe(1);
      expect(result.userCounts.get('F001')?.implementationCount).toBe(1);
    });

    it('should increment user count on new implementation', () => {
      const existingUserCounts = new Map<string, UserVisitCount>([
        ['F001', {
          friendId: 'F001',
          implementationCount: 1,
          lastSessionDate: new Date('2024-11-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      ]);

      const csvRecords: CsvInputRecord[] = [
        {
          reservationId: 'R002',
          friendId: 'F001',
          name: 'テスト太郎',
          sessionDate: new Date('2024-12-01'),
          applicationDate: new Date('2024-11-25'),
          status: '予約済み',
          visitStatus: '済み',
          staff: null,
          detailStatus: null,
          wasOmakase: false,
        },
      ];

      const result = mergeCsvToHistories(new Map(), existingUserCounts, csvRecords);
      expect(result.userCounts.get('F001')?.implementationCount).toBe(2);
    });
  });

  describe('recalculateAllVisitIndexes', () => {
    it('should recalculate visit indexes correctly', () => {
      const histories = new Map<string, ReservationHistory>([
        ['R001', {
          reservationId: 'R001',
          friendId: 'F001',
          name: 'テスト太郎',
          sessionDate: new Date('2024-12-01'),
          applicationDate: new Date('2024-11-25'),
          status: '予約済み',
          visitStatus: '済み',
          isImplemented: true,
          staff: null,
          detailStatus: null,
          visitIndex: 0, // 不正なインデックス
          visitLabel: '初回',
          isExcluded: false,
          wasOmakase: false,
          groupId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
        ['R002', {
          reservationId: 'R002',
          friendId: 'F001',
          name: 'テスト太郎',
          sessionDate: new Date('2024-12-05'),
          applicationDate: new Date('2024-11-28'),
          status: '予約済み',
          visitStatus: '済み',
          isImplemented: true,
          staff: null,
          detailStatus: null,
          visitIndex: 0,
          visitLabel: '初回',
          isExcluded: false,
          wasOmakase: false,
          groupId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      ]);

      const result = recalculateAllVisitIndexes(histories);

      // 日付順で再計算
      expect(result.histories.get('R001')?.visitIndex).toBe(1);
      expect(result.histories.get('R002')?.visitIndex).toBe(2);
      expect(result.userCounts.get('F001')?.implementationCount).toBe(2);
    });
  });

  describe('filterByPeriod', () => {
    const histories = new Map<string, ReservationHistory>([
      ['R001', {
        reservationId: 'R001',
        friendId: 'F001',
        name: 'テスト太郎',
        sessionDate: new Date('2024-12-01'),
        applicationDate: new Date('2024-11-25'),
        status: '予約済み',
        visitStatus: '済み',
        isImplemented: true,
        staff: null,
        detailStatus: null,
        visitIndex: 1,
        visitLabel: '初回',
        isExcluded: false,
        wasOmakase: false,
        groupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
      ['R002', {
        reservationId: 'R002',
        friendId: 'F002',
        name: 'テスト次郎',
        sessionDate: new Date('2024-12-15'),
        applicationDate: new Date('2024-12-10'),
        status: '予約済み',
        visitStatus: '済み',
        isImplemented: true,
        staff: null,
        detailStatus: null,
        visitIndex: 1,
        visitLabel: '初回',
        isExcluded: false,
        wasOmakase: false,
        groupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
    ]);

    it('should filter by session date', () => {
      const result = filterByPeriod(
        histories,
        new Date('2024-12-01'),
        new Date('2024-12-10'),
        'session'
      );
      expect(result.length).toBe(1);
      expect(result[0].reservationId).toBe('R001');
    });

    it('should filter by application date', () => {
      const result = filterByPeriod(
        histories,
        new Date('2024-12-01'),
        new Date('2024-12-31'),
        'application'
      );
      expect(result.length).toBe(1);
      expect(result[0].reservationId).toBe('R002');
    });
  });

  describe('calculateSummary', () => {
    const records: ReservationHistory[] = [
      {
        reservationId: 'R001',
        friendId: 'F001',
        name: 'テスト太郎',
        sessionDate: new Date('2024-12-01'),
        applicationDate: new Date('2024-11-25'),
        status: '予約済み',
        visitStatus: '済み',
        isImplemented: true,
        staff: null,
        detailStatus: null,
        visitIndex: 1,
        visitLabel: '初回',
        isExcluded: false,
        wasOmakase: false,
        groupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        reservationId: 'R002',
        friendId: 'F001',
        name: 'テスト太郎',
        sessionDate: new Date('2024-12-05'),
        applicationDate: new Date('2024-11-28'),
        status: '予約済み',
        visitStatus: '済み',
        isImplemented: true,
        staff: null,
        detailStatus: null,
        visitIndex: 2,
        visitLabel: '2回目',
        isExcluded: false,
        wasOmakase: false,
        groupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        reservationId: 'R003',
        friendId: 'F002',
        name: 'キャンセル花子',
        sessionDate: new Date('2024-12-05'),
        applicationDate: new Date('2024-11-28'),
        status: 'キャンセル済み',
        visitStatus: 'なし',
        isImplemented: false,
        staff: null,
        detailStatus: null,
        visitIndex: 0,
        visitLabel: '初回',
        isExcluded: false,
        wasOmakase: false,
        groupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should calculate summary correctly', () => {
      const summary = calculateSummary(
        records,
        new Date('2024-12-01'),
        new Date('2024-12-31'),
        'session'
      );

      expect(summary.totalRecords).toBe(3);
      expect(summary.totalImplementations).toBe(2);
      expect(summary.totalCancellations).toBe(1);
      expect(summary.firstTimeCount).toBe(1);
      expect(summary.repeatCount).toBe(1);
    });

    it('should exclude excluded records', () => {
      const withExcluded = [
        ...records,
        {
          ...records[0],
          reservationId: 'R004',
          isExcluded: true,
        },
      ];

      const summary = calculateSummary(
        withExcluded,
        new Date('2024-12-01'),
        new Date('2024-12-31'),
        'session'
      );

      expect(summary.totalRecords).toBe(3); // 除外されたものはカウントしない
    });
  });

  describe('calculateDailyAggregation', () => {
    const records: ReservationHistory[] = [
      {
        reservationId: 'R001',
        friendId: 'F001',
        name: 'テスト太郎',
        sessionDate: new Date('2024-12-01'),
        applicationDate: new Date('2024-11-25'),
        status: '予約済み',
        visitStatus: '済み',
        isImplemented: true,
        staff: null,
        detailStatus: null,
        visitIndex: 1,
        visitLabel: '初回',
        isExcluded: false,
        wasOmakase: false,
        groupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        reservationId: 'R002',
        friendId: 'F002',
        name: 'テスト次郎',
        sessionDate: new Date('2024-12-01'),
        applicationDate: new Date('2024-11-26'),
        status: '予約済み',
        visitStatus: '済み',
        isImplemented: true,
        staff: null,
        detailStatus: null,
        visitIndex: 1,
        visitLabel: '初回',
        isExcluded: false,
        wasOmakase: false,
        groupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should aggregate by day', () => {
      const daily = calculateDailyAggregation(records, 'session');

      expect(daily.length).toBe(1);
      expect(daily[0].date).toBe('2024-12-01');
      expect(daily[0].totalRecords).toBe(2);
      expect(daily[0].implementations).toBe(2);
      expect(daily[0].firstTimeCount).toBe(2);
    });
  });

  describe('historyToFlatRecord', () => {
    it('should convert history to flat record', () => {
      const history: ReservationHistory = {
        reservationId: 'R001',
        friendId: 'F001',
        name: 'テスト太郎',
        sessionDate: new Date('2024-12-01'),
        applicationDate: new Date('2024-11-25T10:30:00'),
        status: '予約済み',
        visitStatus: '済み',
        isImplemented: true,
        staff: '担当者A',
        detailStatus: null,
        visitIndex: 1,
        visitLabel: '初回',
        isExcluded: false,
        wasOmakase: true,
        groupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const flat = historyToFlatRecord(history);

      expect(flat.reservationId).toBe('R001');
      expect(flat.sessionDateStr).toBe('2024-12-01');
      expect(flat.applicationDateStr).toBe('2024-11-25 10:30');
      expect(flat.visitLabel).toBe('初回');
      expect(flat.wasOmakase).toBe(true);
    });
  });

  describe('historiesToFlatRecords', () => {
    it('should convert and sort histories descending by date', () => {
      const histories = new Map<string, ReservationHistory>([
        ['R001', {
          reservationId: 'R001',
          friendId: 'F001',
          name: 'テスト太郎',
          sessionDate: new Date('2024-12-01'),
          applicationDate: new Date('2024-11-25'),
          status: '予約済み',
          visitStatus: '済み',
          isImplemented: true,
          staff: null,
          detailStatus: null,
          visitIndex: 1,
          visitLabel: '初回',
          isExcluded: false,
          wasOmakase: false,
          groupId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
        ['R002', {
          reservationId: 'R002',
          friendId: 'F002',
          name: 'テスト次郎',
          sessionDate: new Date('2024-12-05'),
          applicationDate: new Date('2024-11-28'),
          status: '予約済み',
          visitStatus: '済み',
          isImplemented: true,
          staff: null,
          detailStatus: null,
          visitIndex: 1,
          visitLabel: '初回',
          isExcluded: false,
          wasOmakase: false,
          groupId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      ]);

      const flat = historiesToFlatRecords(histories);

      expect(flat.length).toBe(2);
      expect(flat[0].reservationId).toBe('R002'); // 新しい方が先
      expect(flat[1].reservationId).toBe('R001');
    });
  });

  describe('flatRecordsToCSV', () => {
    it('should generate valid CSV', () => {
      const records = [
        {
          reservationId: 'R001',
          friendId: 'F001',
          name: 'テスト太郎',
          sessionDateStr: '2024-12-01',
          applicationDateStr: '2024-11-25 10:30',
          status: '予約済み' as const,
          visitStatus: '済み' as const,
          isImplemented: true,
          visitIndex: 1,
          visitLabel: '初回' as const,
          isExcluded: false,
          wasOmakase: false,
          staff: '担当者A',
          detailStatus: null,
        },
      ];

      const csv = flatRecordsToCSV(records);

      expect(csv).toContain('予約ID,友だちID,名前');
      expect(csv).toContain('R001,F001,テスト太郎');
    });

    it('should escape CSV special characters', () => {
      const records = [
        {
          reservationId: 'R001',
          friendId: 'F001',
          name: 'テスト,太郎', // カンマを含む
          sessionDateStr: '2024-12-01',
          applicationDateStr: '2024-11-25 10:30',
          status: '予約済み' as const,
          visitStatus: '済み' as const,
          isImplemented: true,
          visitIndex: 1,
          visitLabel: '初回' as const,
          isExcluded: false,
          wasOmakase: false,
          staff: null,
          detailStatus: null,
        },
      ];

      const csv = flatRecordsToCSV(records);
      expect(csv).toContain('"テスト,太郎"'); // ダブルクォートでエスケープ
    });

    it('should sanitize dangerous characters', () => {
      const records = [
        {
          reservationId: 'R001',
          friendId: 'F001',
          name: '=DANGEROUS()',
          sessionDateStr: '2024-12-01',
          applicationDateStr: '2024-11-25 10:30',
          status: '予約済み' as const,
          visitStatus: '済み' as const,
          isImplemented: true,
          visitIndex: 1,
          visitLabel: '初回' as const,
          isExcluded: false,
          wasOmakase: false,
          staff: null,
          detailStatus: null,
        },
      ];

      const csv = flatRecordsToCSV(records);
      expect(csv).toContain("'=DANGEROUS()"); // 先頭にシングルクォート
    });
  });
});
