/**
 * 2024年CSV専用パーサーのテスト
 */
import { describe, it, expect } from 'vitest';
import { is2024Format, parse2024CSV } from './csv2024Parser';

describe('csv2024Parser', () => {
  describe('is2024Format', () => {
    it('ファイル名に2024が含まれる場合はtrue', () => {
      const headers = ['友だちID', '予約日', '名前'];
      expect(is2024Format(headers, '予約データ_2024年.csv')).toBe(true);
      expect(is2024Format(headers, '2024_reservations.csv')).toBe(true);
      expect(is2024Format(headers, 'backup_2024-12.csv')).toBe(true);
    });

    it('予約枠列がない場合はtrue（2025年の特徴的な列がない）', () => {
      const headers2024 = ['友だちID', '予約日', '名前', 'ステータス', '来店/来場'];
      expect(is2024Format(headers2024)).toBe(true);
    });

    it('予約枠列がある場合はfalse（2025年形式）', () => {
      const headers2025 = ['友だちID', '予約日', '名前', 'ステータス', '来店/来場', '予約枠'];
      expect(is2024Format(headers2025)).toBe(false);
    });

    it('コース列がある場合はfalse（2025年形式）', () => {
      const headers2025 = ['友だちID', '予約日', '名前', 'ステータス', '来店/来場', 'コース'];
      expect(is2024Format(headers2025)).toBe(false);
    });

    it('予約枠（担当者名）列がある場合はfalse', () => {
      const headers2025 = ['友だちID', '予約日', '名前', 'ステータス', '来店/来場', '予約枠（担当者名）'];
      expect(is2024Format(headers2025)).toBe(false);
    });

    it('最低限の列がない場合はfalse', () => {
      const invalidHeaders = ['名前', 'ステータス'];
      expect(is2024Format(invalidHeaders)).toBe(false);
    });
  });

  describe('parse2024CSV', () => {
    it('基本的な2024年CSVをパースできる', async () => {
      const csvText = `友だちID,予約日,名前,ステータス,来店/来場
F001,2024-03-15,山田太郎,予約済み,済み
F002,2024-03-16,鈴木花子,キャンセル済み,なし`;

      const result = await parse2024CSV(csvText, '2024_data.csv');

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);

      // 担当者は全てundefined
      expect(result.data[0].担当者).toBeUndefined();
      expect(result.data[1].担当者).toBeUndefined();

      // wasOmakaseはfalse
      expect(result.data[0].wasOmakase).toBe(false);
      expect(result.data[1].wasOmakase).toBe(false);

      // ステータスと来店/来場は正規化される
      expect(result.data[0].ステータス).toBe('予約済み');
      expect(result.data[0]['来店/来場']).toBe('済み');
      expect(result.data[1].ステータス).toBe('キャンセル済み');
      expect(result.data[1]['来店/来場']).toBe('なし');
    });

    it('様々なステータス表記を正規化できる', async () => {
      const csvText = `友だちID,予約日,名前,ステータス,来店/来場
F001,2024-03-15,テスト1,キャンセル,なし
F002,2024-03-16,テスト2,取消,なし
F003,2024-03-17,テスト3,予約,済み
F004,2024-03-18,テスト4,確定,済み`;

      const result = await parse2024CSV(csvText);

      expect(result.success).toBe(true);
      expect(result.data[0].ステータス).toBe('キャンセル済み');
      expect(result.data[1].ステータス).toBe('キャンセル済み');
      expect(result.data[2].ステータス).toBe('予約済み');
      expect(result.data[3].ステータス).toBe('予約済み');
    });

    it('様々な来店/来場表記を正規化できる', async () => {
      const csvText = `友だちID,予約日,名前,ステータス,来店/来場
F001,2024-03-15,テスト1,予約済み,済み
F002,2024-03-16,テスト2,予約済み,完了
F003,2024-03-17,テスト3,予約済み,来店
F004,2024-03-18,テスト4,予約済み,実施済み
F005,2024-03-19,テスト5,予約済み,なし
F006,2024-03-20,テスト6,予約済み,未来店`;

      const result = await parse2024CSV(csvText);

      expect(result.success).toBe(true);
      expect(result.data[0]['来店/来場']).toBe('済み');
      expect(result.data[1]['来店/来場']).toBe('済み');
      expect(result.data[2]['来店/来場']).toBe('済み');
      expect(result.data[3]['来店/来場']).toBe('済み');
      expect(result.data[4]['来店/来場']).toBe('なし');
      expect(result.data[5]['来店/来場']).toBe('なし');
    });

    it('来店/来場列がなくてもステータスから判定できる', async () => {
      const csvText = `友だちID,予約日,名前,ステータス
F001,2024-03-15,テスト1,完了
F002,2024-03-16,テスト2,来店済み
F003,2024-03-17,テスト3,キャンセル`;

      const result = await parse2024CSV(csvText);

      expect(result.success).toBe(true);
      expect(result.data[0]['来店/来場']).toBe('済み');
      expect(result.data[1]['来店/来場']).toBe('済み');
      expect(result.data[2]['来店/来場']).toBe('なし');
    });

    it('予約IDが自動生成される', async () => {
      const csvText = `友だちID,予約日,名前,ステータス,来店/来場
F001,2024-03-15,山田太郎,予約済み,済み`;

      const result = await parse2024CSV(csvText);

      expect(result.success).toBe(true);
      expect(result.data[0].予約ID).toMatch(/^2024_\d+$/);
    });

    it('申込日時がない場合は予約日を使用', async () => {
      const csvText = `友だちID,予約日,名前,ステータス,来店/来場
F001,2024-03-15,山田太郎,予約済み,済み`;

      const result = await parse2024CSV(csvText);

      expect(result.success).toBe(true);
      expect(result.data[0].申込日時).toBe('2024-03-15');
    });

    it('友だちIDまたは予約日が空の行はスキップ', async () => {
      const csvText = `友だちID,予約日,名前,ステータス,来店/来場
F001,2024-03-15,山田太郎,予約済み,済み
,2024-03-16,空ID,予約済み,済み
F003,,空日付,予約済み,済み`;

      const result = await parse2024CSV(csvText);

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);
      expect(result.warnings.some(w => w.includes('スキップ'))).toBe(true);
    });

    it('必須カラムが不足している場合はエラー', async () => {
      const csvText = `名前,ステータス
山田太郎,予約済み`;

      const result = await parse2024CSV(csvText);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('必須カラム'))).toBe(true);
    });

    it('2024年形式の警告メッセージが出力される', async () => {
      const csvText = `友だちID,予約日,名前,ステータス,来店/来場
F001,2024-03-15,山田太郎,予約済み,済み`;

      const result = await parse2024CSV(csvText, '2024_data.csv');

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('[2024年形式]'))).toBe(true);
      expect(result.warnings.some(w => w.includes('担当者=未割当'))).toBe(true);
    });

    it('別のカラム名バリエーションにも対応', async () => {
      const csvText = `友だちID,日付,お客さま,予約ステータス,来店
F001,2024-03-15,山田太郎,予約済み,済み`;

      const result = await parse2024CSV(csvText);

      expect(result.success).toBe(true);
      expect(result.data[0].予約日).toBe('2024-03-15');
      expect(result.data[0].名前).toBe('山田太郎');
    });

    it('メモ/備考列がある場合は取り込まれる', async () => {
      const csvText = `友だちID,予約日,名前,ステータス,来店/来場,メモ
F001,2024-03-15,山田太郎,予約済み,済み,初回相談希望`;

      const result = await parse2024CSV(csvText);

      expect(result.success).toBe(true);
      expect(result.data[0].メモ).toBe('初回相談希望');
    });

    it('空のCSVはエラー', async () => {
      const csvText = `友だちID,予約日,名前,ステータス,来店/来場`;

      const result = await parse2024CSV(csvText);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('有効なデータが見つかりません'))).toBe(true);
    });
  });
});
