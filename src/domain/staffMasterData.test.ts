/**
 * 担当者判定ロジックのテスト
 */
import { describe, it, expect } from 'vitest';
import { classifyReservationSlot, OFFICIAL_STAFF_MEMBERS } from './staffMasterData';

describe('classifyReservationSlot', () => {
  describe('正式担当者の判定', () => {
    it.each(OFFICIAL_STAFF_MEMBERS)('「%s」は担当者として認識される', (staffName) => {
      const result = classifyReservationSlot(staffName);
      expect(result.staffName).toBe(staffName);
      expect(result.wasOmakase).toBe(false);
    });

    it('全角英数字でも認識される（J.K → J.K）', () => {
      const result = classifyReservationSlot('Ｊ．Ｋ');
      expect(result.staffName).toBe('J.K');
      expect(result.wasOmakase).toBe(false);
    });

    it('前後にスペースがあっても認識される', () => {
      const result = classifyReservationSlot('  佐々木宏明  ');
      expect(result.staffName).toBe('佐々木宏明');
      expect(result.wasOmakase).toBe(false);
    });
  });

  describe('おまかせパターンの判定', () => {
    it('「事務局にお任せ（日程が変更になる可能性があります）」はおまかせ', () => {
      const result = classifyReservationSlot('事務局にお任せ（日程が変更になる可能性があります）');
      expect(result.staffName).toBeNull();
      expect(result.wasOmakase).toBe(true);
    });

    it('「塩見千重子（予約日により別日の調整を依頼する可能性があります）」はおまかせ', () => {
      const result = classifyReservationSlot('塩見千重子（予約日により別日の調整を依頼する可能性があります）');
      expect(result.staffName).toBeNull();
      expect(result.wasOmakase).toBe(true);
    });

    it('「担当者変更の可能性があります」を含むとおまかせ', () => {
      const result = classifyReservationSlot('佐々木宏明（担当者変更の可能性があります）');
      expect(result.staffName).toBeNull();
      expect(result.wasOmakase).toBe(true);
    });

    it('「調整中」を含むとおまかせ', () => {
      const result = classifyReservationSlot('調整中');
      expect(result.staffName).toBeNull();
      expect(result.wasOmakase).toBe(true);
    });
  });

  describe('備考コメントの判定', () => {
    it('「※時間変更の可能性あり」は備考扱い', () => {
      const result = classifyReservationSlot('※時間変更の可能性あり');
      expect(result.staffName).toBeNull();
      expect(result.wasOmakase).toBe(false);
    });

    it('「※別日調整依頼」は備考扱い', () => {
      const result = classifyReservationSlot('※別日調整依頼');
      expect(result.staffName).toBeNull();
      expect(result.wasOmakase).toBe(false);
    });
  });

  describe('空・不明パターンの判定', () => {
    it('空文字は担当者なし', () => {
      const result = classifyReservationSlot('');
      expect(result.staffName).toBeNull();
      expect(result.wasOmakase).toBe(false);
    });

    it('nullは担当者なし', () => {
      const result = classifyReservationSlot(null);
      expect(result.staffName).toBeNull();
      expect(result.wasOmakase).toBe(false);
    });

    it('undefinedは担当者なし', () => {
      const result = classifyReservationSlot(undefined);
      expect(result.staffName).toBeNull();
      expect(result.wasOmakase).toBe(false);
    });

    it('未知の文字列は担当者なし・おまかせでもない', () => {
      const result = classifyReservationSlot('山田太郎');
      expect(result.staffName).toBeNull();
      expect(result.wasOmakase).toBe(false);
    });
  });
});
