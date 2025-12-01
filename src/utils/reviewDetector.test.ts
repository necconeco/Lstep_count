/**
 * reviewDetector.ts ユニットテスト
 */
import { describe, it, expect } from 'vitest';
import {
  detectPattern1,
  detectPattern2,
  detectPattern3,
  generateCancellationList,
} from './reviewDetector';
import type { CsvRecord, UserHistoryMaster } from '../types';

describe('reviewDetector', () => {
  describe('detectPattern1', () => {
    it('should detect data inconsistency (キャンセル済み + 来店済み)', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '001',
          友だちID: 'friend001',
          予約日: '2025-12-01',
          ステータス: 'キャンセル済み',
          '来店/来場': '済み',
          名前: 'テスト太郎',
          申込日時: '2025-11-30 10:00',
        },
      ];

      const result = detectPattern1(csvData);

      expect(result.length).toBe(1);
      expect(result[0]!.pattern).toBe('pattern1');
      expect(result[0]!.patternName).toContain('データ不整合');
      expect(result[0]!.record.予約ID).toBe('001');
    });

    it('should not detect normal records', () => {
      const csvData: CsvRecord[] = [
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

      const result = detectPattern1(csvData);

      expect(result.length).toBe(0);
    });
  });

  describe('detectPattern2', () => {
    it('should detect not visited (予約済み + 未来店)', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '003',
          友だちID: 'friend003',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': 'なし',
          名前: 'テスト三郎',
          申込日時: '2025-11-30 12:00',
        },
      ];

      const result = detectPattern2(csvData);

      expect(result.length).toBe(1);
      expect(result[0]!.pattern).toBe('pattern2');
      expect(result[0]!.patternName).toContain('未来店');
      expect(result[0]!.record.予約ID).toBe('003');
    });

    it('should not detect implemented records', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '004',
          友だちID: 'friend004',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト四郎',
          申込日時: '2025-11-30 13:00',
        },
      ];

      const result = detectPattern2(csvData);

      expect(result.length).toBe(0);
    });
  });

  describe('detectPattern3', () => {
    it('should detect normal cancellation (キャンセル済み + 未来店)', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '005',
          友だちID: 'friend005',
          予約日: '2025-12-01',
          ステータス: 'キャンセル済み',
          '来店/来場': 'なし',
          名前: 'テスト五郎',
          申込日時: '2025-11-30 14:00',
        },
      ];

      const result = detectPattern3(csvData);

      expect(result.length).toBe(1);
      expect(result[0]!.pattern).toBe('pattern3');
      expect(result[0]!.patternName).toContain('通常キャンセル');
      expect(result[0]!.record.予約ID).toBe('005');
    });

    it('should not detect reserved records', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '006',
          友だちID: 'friend006',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': 'なし',
          名前: 'テスト六郎',
          申込日時: '2025-11-30 15:00',
        },
      ];

      const result = detectPattern3(csvData);

      expect(result.length).toBe(0);
    });
  });

  describe('generateCancellationList', () => {
    it('should generate cancellation list with visit type', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '007',
          友だちID: 'friend007',
          予約日: '2025-12-01',
          ステータス: 'キャンセル済み',
          '来店/来場': 'なし',
          名前: 'テスト七郎',
          申込日時: '2025-11-30 16:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = generateCancellationList(csvData, masterData);

      expect(result.length).toBe(1);
      expect(result[0]!.record.予約ID).toBe('007');
      expect(result[0]!.visitType).toBe('初回');
      expect(result[0]!.cancellationDate).toBe('2025-12-01');
    });

    it('should detect repeat cancellation', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '008',
          友だちID: 'friend008',
          予約日: '2025-12-02',
          ステータス: 'キャンセル済み',
          '来店/来場': 'なし',
          名前: 'テスト八郎',
          申込日時: '2025-12-01 10:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>([
        [
          'friend008',
          {
            friendId: 'friend008',
            implementationCount: 1,
            lastImplementationDate: new Date('2025-11-01'),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ]);

      const result = generateCancellationList(csvData, masterData);

      expect(result.length).toBe(1);
      expect(result[0]!.visitType).toBe('2回目');
    });

    it('should not include non-cancelled records', () => {
      const csvData: CsvRecord[] = [
        {
          予約ID: '009',
          友だちID: 'friend009',
          予約日: '2025-12-01',
          ステータス: '予約済み',
          '来店/来場': '済み',
          名前: 'テスト九郎',
          申込日時: '2025-11-30 17:00',
        },
      ];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = generateCancellationList(csvData, masterData);

      expect(result.length).toBe(0);
    });

    it('should handle empty data', () => {
      const csvData: CsvRecord[] = [];
      const masterData = new Map<string, UserHistoryMaster>();

      const result = generateCancellationList(csvData, masterData);

      expect(result.length).toBe(0);
    });
  });
});
