/**
 * dataAggregator.ts ユニットテスト
 */
import { describe, it, expect } from 'vitest';
import {
  isImplemented,
  getImplementationStatus,
  getVisitType,
  updateMasterData,
  aggregateSummary,
  aggregateByStaff,
  aggregateByDate,
  aggregateByMonth,
  generateSpreadsheetData,
  aggregateAll,
  autoPopulateUsageCount,
} from './dataAggregator';
import type { CsvRecord, UserHistoryMaster } from '../types';

describe('dataAggregator', () => {
  describe('isImplemented', () => {
    it('should return true for implemented record', () => {
      const record: CsvRecord = {
        予約ID: '001',
        友だちID: 'friend001',
        予約日: '2025-12-01',
        ステータス: '予約済み',
        '来店/来場': '済み',
        名前: 'テスト太郎',
        申込日時: '2025-11-30 10:00',
      };
      expect(isImplemented(record)).toBe(true);
    });

    it('should return false for not visited', () => {
      const record: CsvRecord = {
        予約ID: '002',
        友だちID: 'friend002',
        予約日: '2025-12-01',
        ステータス: '予約済み',
        '来店/来場': 'なし',
        名前: 'テスト次郎',
        申込日時: '2025-11-30 11:00',
      };
      expect(isImplemented(record)).toBe(false);
    });

    it('should return false for cancelled', () => {
      const record: CsvRecord = {
        予約ID: '003',
        友だちID: 'friend003',
        予約日: '2025-12-01',
        ステータス: 'キャンセル済み',
        '来店/来場': 'なし',
        名前: 'テスト三郎',
        申込日時: '2025-11-30 12:00',
      };
      expect(isImplemented(record)).toBe(false);
    });

    it('should return true for 前日キャンセル with detail status', () => {
      const record: CsvRecord = {
        予約ID: '004',
        友だちID: 'friend004',
        予約日: '2025-12-01',
        ステータス: 'キャンセル済み',
        '来店/来場': 'なし',
        名前: 'テスト四郎',
        申込日時: '2025-11-30 12:00',
        詳細ステータス: '前日キャンセル',
      };
      expect(isImplemented(record)).toBe(true);
    });

    it('should return true for 当日キャンセル with detail status', () => {
      const record: CsvRecord = {
        予約ID: '005',
        友だちID: 'friend005',
        予約日: '2025-12-01',
        ステータス: 'キャンセル済み',
        '来店/来場': 'なし',
        名前: 'テスト五郎',
        申込日時: '2025-11-30 12:00',
        詳細ステータス: '当日キャンセル',
      };
      expect(isImplemented(record)).toBe(true);
    });
  });

  describe('getImplementationStatus', () => {
    it('should return "実施済み" for implemented record', () => {
      const record: CsvRecord = {
        予約ID: '001',
        友だちID: 'friend001',
        予約日: '2025-12-01',
        ステータス: '予約済み',
        '来店/来場': '済み',
        名前: 'テスト太郎',
        申込日時: '2025-11-30 10:00',
      };
      expect(getImplementationStatus(record)).toBe('実施済み');
    });

    it('should return "キャンセル済み" for cancelled record', () => {
      const record: CsvRecord = {
        予約ID: '002',
        友だちID: 'friend002',
        予約日: '2025-12-01',
        ステータス: 'キャンセル済み',
        '来店/来場': 'なし',
        名前: 'テスト次郎',
        申込日時: '2025-11-30 11:00',
      };
      expect(getImplementationStatus(record)).toBe('キャンセル済み');
    });

    it('should return "予約中" for pending record', () => {
      const record: CsvRecord = {
        予約ID: '003',
        友だちID: 'friend003',
        予約日: '2025-12-01',
        ステータス: '予約済み',
        '来店/来場': 'なし',
        名前: 'テスト三郎',
        申込日時: '2025-11-30 12:00',
      };
      expect(getImplementationStatus(record)).toBe('予約中');
    });
  });

  describe('getVisitType', () => {
    it('should return "初回" for new user', () => {
      const masterData = new Map<string, UserHistoryMaster>();
      const result = getVisitType('friend001', masterData);
      expect(result).toBe('初回');
    });

    it('should return "初回" for user with 0 count', () => {
      const masterData = new Map<string, UserHistoryMaster>([
        [
          'friend001',
          {
            friendId: 'friend001',
            implementationHistory: [],
            implementationCount: 0,
            lastImplementationDate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastStaff: null,
          },
        ],
      ]);
      const result = getVisitType('friend001', masterData);
      expect(result).toBe('初回');
    });

    it('should return "2回目" for user with 1 count', () => {
      const masterData = new Map<string, UserHistoryMaster>([
        [
          'friend001',
          {
            friendId: 'friend001',
            implementationHistory: [
              {
                date: new Date('2025-11-01'),
                reservationId: '001',
                status: '予約済み',
              },
            ],
            implementationCount: 1,
            lastImplementationDate: new Date('2025-11-01'),
            createdAt: new Date(),
            updatedAt: new Date(),
            lastStaff: null,
          },
        ],
      ]);
      const result = getVisitType('friend001', masterData);
      expect(result).toBe('2回目');
    });

    it('should return "3回目以降" for user with 2+ count', () => {
      const masterData = new Map<string, UserHistoryMaster>([
        [
          'friend001',
          {
            friendId: 'friend001',
            implementationHistory: [
              {
                date: new Date('2025-10-01'),
                reservationId: '001',
                status: '予約済み',
              },
              {
                date: new Date('2025-11-01'),
                reservationId: '002',
                status: '予約済み',
              },
            ],
            implementationCount: 2,
            lastImplementationDate: new Date('2025-11-01'),
            createdAt: new Date(),
            updatedAt: new Date(),
            lastStaff: null,
          },
        ],
      ]);
      const result = getVisitType('friend001', masterData);
      expect(result).toBe('3回目以降');
    });
  });

  describe('updateMasterData', () => {
    it('should create new master record for first implementation', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = updateMasterData(csvData, masterData);

      expect(result.size).toBe(1);
      expect(result.has('friend001')).toBe(true);
      const record = result.get('friend001');
      expect(record?.implementationCount).toBe(1);
      expect(record?.lastImplementationDate).toBeInstanceOf(Date);
    });

    it('should increment count for repeat implementation', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '002',
          友だちID: 'friend001',
          予約日: '2025-12-02',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-12-01 10:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>([
        [
          'friend001',
          {
            friendId: 'friend001',
            allHistory: [
              {
                date: new Date('2025-12-01'),
                reservationId: '001',
                status: '予約済み',
                visitStatus: '済み',
                isImplemented: true,
              },
            ],
            implementationHistory: [
              {
                date: new Date('2025-12-01'),
                reservationId: '001',
                status: '予約済み',
              },
            ],
            implementationCount: 1,
            lastImplementationDate: new Date('2025-12-01'),
            createdAt: new Date(),
            updatedAt: new Date(),
            lastStaff: null,
          },
        ],
      ]);

      const result = updateMasterData(csvData, masterData);

      expect(result.size).toBe(1);
      const record = result.get('friend001');
      expect(record?.implementationCount).toBe(2);
    });

    it('should not update implementationCount for cancelled records', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '003',
          友だちID: 'friend001',
          予約日: '2025-12-03',
          ステータス: 'キャンセル済み',
          '来店/来場': 'なし',
          名前: 'テスト太郎',
          申込日時: '2025-12-02 10:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = updateMasterData(csvData, masterData);

      // キャンセルでもallHistoryには記録されるため、マスターは作成される
      expect(result.size).toBe(1);
      const record = result.get('friend001');
      // ただしimplementationCountは0のまま
      expect(record?.implementationCount).toBe(0);
      expect(record?.allHistory.length).toBe(1);
      expect(record?.implementationHistory.length).toBe(0);
    });
  });

  describe('aggregateSummary', () => {
    it('should calculate correct summary', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
        },
        {
          予約ID: '002',
          友だちID: 'friend002',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': 'なし',
          名前: 'テスト次郎',
          申込日時: '2025-11-30 11:00',
        },
        {
          予約ID: '003',
          友だちID: 'friend003',
          予約日: '2025-12-01',
          ステータス: 'キャンセル済み',
          '来店/来場': 'なし',
          名前: 'テスト三郎',
          申込日時: '2025-11-30 12:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = aggregateSummary(csvData, masterData);

      expect(result.totalApplications).toBe(3);
      expect(result.totalImplementations).toBe(1);
      expect(result.totalCancellations).toBe(1);
      expect(result.implementationRate).toBeCloseTo(33.3, 1);
      expect(result.firstTimeImplementations).toBe(1);
      expect(result.repeatImplementations).toBe(0);
    });

    it('should handle empty data', () => {
      const csvData: CsvRecord[] = [];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = aggregateSummary(csvData, masterData);

      expect(result.totalApplications).toBe(0);
      expect(result.totalImplementations).toBe(0);
      expect(result.totalCancellations).toBe(0);
      expect(result.implementationRate).toBe(0);
    });
  });

  describe('aggregateByStaff', () => {
    it('should aggregate by staff correctly', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
          担当者: '山田',
        },
        {
          予約ID: '002',
          友だちID: 'friend002',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト次郎',
          申込日時: '2025-11-30 11:00',
          担当者: '山田',
        },
        {
          予約ID: '003',
          友だちID: 'friend003',
          予約日: '2025-12-01',
          ステータス: 'キャンセル済み',
          '来店/来場': 'なし',
          名前: 'テスト三郎',
          申込日時: '2025-11-30 12:00',
          担当者: '田中',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = aggregateByStaff(csvData, masterData);

      expect(result.length).toBe(2);

      const yamada = result.find(r => r.staffName === '山田');
      expect(yamada).toBeDefined();
      expect(yamada?.applications).toBe(2);
      expect(yamada?.implementations).toBe(2);
      expect(yamada?.implementationRate).toBe(100);

      const tanaka = result.find(r => r.staffName === '田中');
      expect(tanaka).toBeDefined();
      expect(tanaka?.applications).toBe(1);
      expect(tanaka?.cancellations).toBe(1);
    });

    it('should handle empty担当者 as "未設定"', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = aggregateByStaff(csvData, masterData);

      expect(result.length).toBe(1);
      expect(result[0]!.staffName).toBe('未設定');
    });
  });

  describe('autoPopulateUsageCount', () => {
    const usageCountField = 'キャリア相談のご利用回数を教えてください。';

    it('should auto-fill empty field with "初めて" for first-time users', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
          [usageCountField]: '', // 空欄
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = autoPopulateUsageCount(csvData, masterData);

      expect(result[0]![usageCountField]).toBe('初めて');
    });

    it('should auto-fill empty field with "2回目以上" for repeat users', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '002',
          友だちID: 'friend001',
          予約日: '2025-12-02',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-12-01 10:00',
          [usageCountField]: '', // 空欄
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>([
        [
          'friend001',
          {
            friendId: 'friend001',
            implementationHistory: [
              {
                date: new Date('2025-11-01'),
                reservationId: '001',
                status: '予約済み',
              },
            ],
            implementationCount: 1,
            lastImplementationDate: new Date('2025-11-01'),
            createdAt: new Date(),
            updatedAt: new Date(),
            lastStaff: null,
          },
        ],
      ]);

      const result = autoPopulateUsageCount(csvData, masterData);

      expect(result[0]![usageCountField]).toBe('2回目以上');
    });

    it('should preserve existing values', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
          [usageCountField]: '初めて', // 既に値が入っている
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>([
        [
          'friend001',
          {
            friendId: 'friend001',
            implementationHistory: [
              {
                date: new Date('2025-10-01'),
                reservationId: '000',
                status: '予約済み',
              },
            ],
            implementationCount: 1,
            lastImplementationDate: new Date('2025-10-01'),
            createdAt: new Date(),
            updatedAt: new Date(),
            lastStaff: null,
          },
        ],
      ]);

      const result = autoPopulateUsageCount(csvData, masterData);

      // マスタデータでは2回目だが、既存値「初めて」が保持される
      expect(result[0]![usageCountField]).toBe('初めて');
    });

    it('should handle multiple records', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
          [usageCountField]: '',
        },
        {
          予約ID: '002',
          友だちID: 'friend002',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト次郎',
          申込日時: '2025-11-30 11:00',
          [usageCountField]: '',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>([
        [
          'friend001',
          {
            friendId: 'friend001',
            implementationHistory: [
              {
                date: new Date('2025-11-01'),
                reservationId: '000',
                status: '予約済み',
              },
            ],
            implementationCount: 1,
            lastImplementationDate: new Date('2025-11-01'),
            createdAt: new Date(),
            updatedAt: new Date(),
            lastStaff: null,
          },
        ],
      ]);

      const result = autoPopulateUsageCount(csvData, masterData);

      expect(result[0]![usageCountField]).toBe('2回目以上'); // friend001は2回目
      expect(result[1]![usageCountField]).toBe('初めて'); // friend002は初回
    });
  });

  describe('Staff History Tracking', () => {
    it('should track staff name in implementation history', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
          担当者: '山田',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = updateMasterData(csvData, masterData);

      expect(result.size).toBe(1);
      const record = result.get('friend001');
      expect(record?.implementationHistory[0]?.staff).toBe('山田');
      expect(record?.lastStaff).toBe('山田');
    });

    it('should update lastStaff to the latest staff member', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '002',
          友だちID: 'friend001',
          予約日: '2025-12-02',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-12-01 10:00',
          担当者: '田中',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>([
        [
          'friend001',
          {
            friendId: 'friend001',
            allHistory: [
              {
                date: new Date('2025-12-01'),
                reservationId: '001',
                status: '予約済み',
                visitStatus: '済み',
                isImplemented: true,
                staff: '山田',
              },
            ],
            implementationHistory: [
              {
                date: new Date('2025-12-01'),
                reservationId: '001',
                status: '予約済み',
                staff: '山田',
              },
            ],
            implementationCount: 1,
            lastImplementationDate: new Date('2025-12-01'),
            lastStaff: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ]);

      const result = updateMasterData(csvData, masterData);

      const record = result.get('friend001');
      expect(record?.implementationHistory.length).toBe(2);
      expect(record?.implementationHistory[1]?.staff).toBe('田中');
      expect(record?.lastStaff).toBe('田中');
    });

    it('should preserve lastStaff when担当者 is empty', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '003',
          友だちID: 'friend001',
          予約日: '2025-12-03',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-12-02 10:00',
          // 担当者: undefined (事務局にお任せなど)
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>([
        [
          'friend001',
          {
            friendId: 'friend001',
            allHistory: [
              {
                date: new Date('2025-12-01'),
                reservationId: '001',
                status: '予約済み',
                visitStatus: '済み',
                isImplemented: true,
                staff: '山田',
              },
            ],
            implementationHistory: [
              {
                date: new Date('2025-12-01'),
                reservationId: '001',
                status: '予約済み',
                staff: '山田',
              },
            ],
            implementationCount: 1,
            lastImplementationDate: new Date('2025-12-01'),
            lastStaff: '山田',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ]);

      const result = updateMasterData(csvData, masterData);

      const record = result.get('friend001');
      expect(record?.implementationHistory.length).toBe(2);
      expect(record?.implementationHistory[1]?.staff).toBeUndefined();
      // lastStaffは「山田」のまま保持される
      expect(record?.lastStaff).toBe('山田');
    });

    it('should set lastStaff to null for first-time users with no担当者', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
          // 担当者: undefined
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = updateMasterData(csvData, masterData);

      const record = result.get('friend001');
      expect(record?.lastStaff).toBeNull();
    });
  });

  describe('aggregateByDate', () => {
    it('should aggregate by date correctly', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
        },
        {
          予約ID: '002',
          友だちID: 'friend002',
          予約日: '2025-12-01',
          ステータス: 'キャンセル済み',
          '来店/来場': 'なし',
          名前: 'テスト次郎',
          申込日時: '2025-11-30 11:00',
        },
        {
          予約ID: '003',
          友だちID: 'friend003',
          予約日: '2025-12-02',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト三郎',
          申込日時: '2025-12-01 10:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = aggregateByDate(csvData, masterData);

      expect(result.length).toBe(2);
      expect(result[0]!.date).toBe('2025-12-01');
      expect(result[0]!.applications).toBe(2);
      expect(result[0]!.implementations).toBe(1);
      expect(result[0]!.cancellations).toBe(1);
      expect(result[1]!.date).toBe('2025-12-02');
      expect(result[1]!.applications).toBe(1);
    });

    it('should sort by date ascending', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-03',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-12-02 10:00',
        },
        {
          予約ID: '002',
          友だちID: 'friend002',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト次郎',
          申込日時: '2025-11-30 11:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = aggregateByDate(csvData, masterData);

      expect(result[0]!.date).toBe('2025-12-01');
      expect(result[1]!.date).toBe('2025-12-03');
    });
  });

  describe('aggregateByMonth', () => {
    it('should aggregate by month correctly', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-11-15',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-14 10:00',
        },
        {
          予約ID: '002',
          友だちID: 'friend002',
          予約日: '2025-11-20',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト次郎',
          申込日時: '2025-11-19 11:00',
        },
        {
          予約ID: '003',
          友だちID: 'friend003',
          予約日: '2025-12-01',
          ステータス: 'キャンセル済み',
          '来店/来場': 'なし',
          名前: 'テスト三郎',
          申込日時: '2025-11-30 10:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = aggregateByMonth(csvData, masterData);

      expect(result.length).toBe(2);
      expect(result[0]!.month).toBe('2025-11');
      expect(result[0]!.applications).toBe(2);
      expect(result[0]!.implementations).toBe(2);
      expect(result[0]!.implementationRate).toBe(100);
      expect(result[1]!.month).toBe('2025-12');
      expect(result[1]!.applications).toBe(1);
      expect(result[1]!.cancellations).toBe(1);
    });

    it('should sort by month ascending', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
        },
        {
          予約ID: '002',
          友だちID: 'friend002',
          予約日: '2025-10-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト次郎',
          申込日時: '2025-09-30 11:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = aggregateByMonth(csvData, masterData);

      expect(result[0]!.month).toBe('2025-10');
      expect(result[1]!.month).toBe('2025-12');
    });
  });

  describe('generateSpreadsheetData', () => {
    it('should generate correct spreadsheet data', () => {
      const summary = {
        totalApplications: 100,
        totalImplementations: 80,
        totalCancellations: 20,
        implementationRate: 80,
        firstTimeApplications: 60,
        firstTimeApplicationRate: 60,
        firstTimeImplementations: 48,
        firstTimeImplementationRate: 80,
        repeatApplications: 40,
        repeatApplicationRate: 40,
        repeatImplementations: 32,
        repeatImplementationRate: 80,
      };

      const result = generateSpreadsheetData(summary);

      expect(result.AB).toBe(60);  // 初回予約合計
      expect(result.AC).toBe(60);  // 初回予約率
      expect(result.AD).toBe(48);  // 初回実施合計
      expect(result.AE).toBe(80);  // 初回実施率
      expect(result.AJ).toBe(40);  // 2回目以降予約合計
      expect(result.AK).toBe(40);  // 2回目以降予約率
      expect(result.AL).toBe(32);  // 2回目以降実施合計
      expect(result.AM).toBe(80);  // 2回目以降実施率
    });

    it('should round rates to 1 decimal place', () => {
      const summary = {
        totalApplications: 3,
        totalImplementations: 1,
        totalCancellations: 1,
        implementationRate: 33.333,
        firstTimeApplications: 2,
        firstTimeApplicationRate: 66.666,
        firstTimeImplementations: 1,
        firstTimeImplementationRate: 50,
        repeatApplications: 1,
        repeatApplicationRate: 33.333,
        repeatImplementations: 0,
        repeatImplementationRate: 0,
      };

      const result = generateSpreadsheetData(summary);

      expect(result.AC).toBe(66.7);  // 四捨五入
      expect(result.AK).toBe(33.3);  // 四捨五入
    });
  });

  describe('aggregateAll', () => {
    it('should return all aggregation results', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
          担当者: '山田',
        },
        {
          予約ID: '002',
          友だちID: 'friend002',
          予約日: '2025-12-02',
          ステータス: 'キャンセル済み',
          '来店/来場': 'なし',
          名前: 'テスト次郎',
          申込日時: '2025-12-01 11:00',
          担当者: '田中',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = aggregateAll(csvData, masterData);

      // 全ての結果が含まれていることを確認
      expect(result.summary).toBeDefined();
      expect(result.staffResults).toBeDefined();
      expect(result.dailyResults).toBeDefined();
      expect(result.monthlyResults).toBeDefined();
      expect(result.spreadsheetData).toBeDefined();

      // サマリーの確認
      expect(result.summary.totalApplications).toBe(2);
      expect(result.summary.totalImplementations).toBe(1);
      expect(result.summary.totalCancellations).toBe(1);

      // 担当者別の確認
      expect(result.staffResults.length).toBe(2);

      // 日別の確認
      expect(result.dailyResults.length).toBe(2);

      // 月別の確認
      expect(result.monthlyResults.length).toBe(1);
      expect(result.monthlyResults[0]!.month).toBe('2025-12');
    });
  });
});
