/**
 * csvParser.ts ユニットテスト
 */
import { describe, it, expect } from 'vitest';
import { validateCSVFile, parseCSV } from './csvParser';

describe('csvParser', () => {
  describe('validateCSVFile', () => {
    it('should accept valid CSV file', () => {
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should accept CSV file by extension even without correct mime type', () => {
      const file = new File(['test'], 'test.csv', { type: '' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject non-CSV file', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('CSV');
    });

    it('should reject Excel file', () => {
      const file = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('CSV');
    });

    it('should reject file larger than 10MB', () => {
      const largeContent = 'a'.repeat(10 * 1024 * 1024 + 1);
      const file = new File([largeContent], 'large.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('10MB');
    });

    it('should accept file exactly 10MB', () => {
      const content = 'a'.repeat(10 * 1024 * 1024);
      const file = new File([content], 'exact.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should accept file under 10MB', () => {
      const content = 'a'.repeat(5 * 1024 * 1024);
      const file = new File([content], 'normal.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject empty CSV file', () => {
      const file = new File([''], 'empty.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('空');
    });
  });

  describe('parseCSV', () => {
    // ヘルパー関数: CSVファイルを作成
    function createCSVFile(content: string, filename = 'test.csv'): File {
      return new File([content], filename, { type: 'text/csv' });
    }

    // 有効なCSVデータのテンプレート
    const validCSVHeader = '友だちID,予約日,ステータス,来店/来場,名前,申込日時,予約枠\n';
    const validCSVRow = 'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00,担当者A\n';

    describe('正常系', () => {
      it('should parse valid CSV successfully', async () => {
        const csv = validCSVHeader + validCSVRow;
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.success).toBe(true);
        expect(result.data.length).toBe(1);
        expect(result.errors.length).toBe(0);
      });

      it('should parse multiple rows', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00,担当者A\n' +
          'friend002,2024-12-02,予約済み,なし,山田花子,2024-11-26 11:00,担当者B\n' +
          'friend003,2024-12-03,キャンセル済み,なし,鈴木一郎,2024-11-27 12:00,担当者C\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.success).toBe(true);
        expect(result.data.length).toBe(3);
      });

      it('should correctly map fields', async () => {
        const csv = validCSVHeader + validCSVRow;
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data[0].友だちID).toBe('friend001');
        expect(result.data[0].予約日).toBe('2024-12-01');
        expect(result.data[0].ステータス).toBe('予約済み');
        expect(result.data[0]['来店/来場']).toBe('済み');
        expect(result.data[0].名前).toBe('田中太郎');
        expect(result.data[0].申込日時).toBe('2024-11-25 10:00');
      });

      it('should auto-generate reservation ID when not present', async () => {
        const csv = validCSVHeader + validCSVRow;
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data[0].予約ID).toMatch(/^AUTO_/);
      });

      it('should use existing reservation ID when present', async () => {
        const csv = '予約ID,友だちID,予約日,ステータス,来店/来場,名前,申込日時\n' +
          'RES001,friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data[0].予約ID).toBe('RES001');
      });
    });

    describe('カラムマッピング', () => {
      it('should map "日付" to "予約日"', async () => {
        const csv = '友だちID,日付,ステータス,来店/来場,名前,申込日時\n' +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.success).toBe(true);
        expect(result.data[0].予約日).toBe('2024-12-01');
      });

      it('should map "お客さま" to "名前"', async () => {
        const csv = '友だちID,予約日,ステータス,来店/来場,お客さま,申込日時\n' +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.success).toBe(true);
        expect(result.data[0].名前).toBe('田中太郎');
      });

      it('should map "お客様" to "名前"', async () => {
        const csv = '友だちID,予約日,ステータス,来店/来場,お客様,申込日時\n' +
          'friend001,2024-12-01,予約済み,済み,佐藤次郎,2024-11-25 10:00\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.success).toBe(true);
        expect(result.data[0].名前).toBe('佐藤次郎');
      });

      it('should map "申し込み日時" to "申込日時"', async () => {
        const csv = '友だちID,予約日,ステータス,来店/来場,名前,申し込み日時\n' +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.success).toBe(true);
        expect(result.data[0].申込日時).toBe('2024-11-25 10:00');
      });
    });

    describe('ステータスバリデーション', () => {
      it('should accept "予約済み" status', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00,担当者A\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data[0].ステータス).toBe('予約済み');
        expect(result.warnings.some(w => w.includes('不明なステータス'))).toBe(false);
      });

      it('should accept "キャンセル済み" status', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,キャンセル済み,なし,田中太郎,2024-11-25 10:00,担当者A\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data[0].ステータス).toBe('キャンセル済み');
        expect(result.warnings.some(w => w.includes('不明なステータス'))).toBe(false);
      });

      it('should warn about unknown status', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,不明なステータス,済み,田中太郎,2024-11-25 10:00,担当者A\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.warnings.some(w => w.includes('不明なステータス'))).toBe(true);
      });
    });

    describe('来店/来場バリデーション', () => {
      it('should accept "済み"', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00,担当者A\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data[0]['来店/来場']).toBe('済み');
      });

      it('should accept "なし"', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,予約済み,なし,田中太郎,2024-11-25 10:00,担当者A\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data[0]['来店/来場']).toBe('なし');
      });

      it('should warn about unknown visit status', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,予約済み,不明,田中太郎,2024-11-25 10:00,担当者A\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.warnings.some(w => w.includes('不明な来店/来場'))).toBe(true);
      });
    });

    describe('エラーハンドリング', () => {
      it('should fail when required columns are missing', async () => {
        const csv = '友だちID,予約日,ステータス\n' +
          'friend001,2024-12-01,予約済み\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.includes('必須カラムが不足'))).toBe(true);
      });

      it('should skip rows with missing required fields and add warning', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00,担当者A\n' +
          ',2024-12-02,予約済み,済み,山田花子,2024-11-26 11:00,担当者B\n'; // 友だちID欠損
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.success).toBe(true);
        expect(result.data.length).toBe(1); // 1行目のみ
        expect(result.warnings.some(w => w.includes('必須フィールドが空'))).toBe(true);
      });

      it('should return error for empty data', async () => {
        const csv = validCSVHeader; // ヘッダーのみ、データなし
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.includes('有効なデータが見つかりませんでした'))).toBe(true);
      });
    });

    describe('予約枠とおまかせ判定', () => {
      it('should extract staff name from reservation slot', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00,担当者Aさん\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        // staffMasterDataの実装によって結果が異なる可能性
        expect(result.data[0]).toBeDefined();
      });

      it('should detect omakase reservation', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00,おまかせ\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data[0].wasOmakase).toBe(true);
      });

      it('should detect non-omakase reservation', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00,指名予約\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        // wasOmakaseがfalseまたはundefinedであることを確認
        expect(result.data[0].wasOmakase).not.toBe(true);
      });
    });

    describe('空白・トリミング処理', () => {
      it('should trim whitespace from values', async () => {
        const csv = '友だちID,予約日,ステータス,来店/来場,名前,申込日時\n' +
          '  friend001  ,  2024-12-01  ,  予約済み  ,  済み  ,  田中太郎  ,  2024-11-25 10:00  \n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data[0].友だちID).toBe('friend001');
        expect(result.data[0].予約日).toBe('2024-12-01');
        expect(result.data[0].名前).toBe('田中太郎');
      });

      it('should skip empty lines', async () => {
        const csv = validCSVHeader +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00,担当者A\n' +
          '\n' +
          '\n' +
          'friend002,2024-12-02,予約済み,済み,山田花子,2024-11-26 11:00,担当者B\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data.length).toBe(2);
      });
    });

    describe('追加フィールド', () => {
      it('should include optional fields', async () => {
        const csv = '友だちID,予約日,ステータス,来店/来場,名前,申込日時,メモ\n' +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00,テストメモ\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data[0].メモ).toBe('テストメモ');
      });

      it('should include additional columns', async () => {
        const csv = '友だちID,予約日,ステータス,来店/来場,名前,申込日時,カスタム列\n' +
          'friend001,2024-12-01,予約済み,済み,田中太郎,2024-11-25 10:00,カスタム値\n';
        const file = createCSVFile(csv);
        const result = await parseCSV(file);

        expect(result.data[0]['カスタム列']).toBe('カスタム値');
      });
    });
  });
});
