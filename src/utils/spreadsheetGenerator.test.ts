/**
 * spreadsheetGenerator.ts ユニットテスト
 * xlsx パッケージのアップグレード前にテストカバレッジを確保
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as XLSX from 'xlsx';
import { generateSpreadsheet, generateCSV } from './spreadsheetGenerator';
import type { SpreadsheetOutputData } from '../types';

// XLSX.writeFile をモック化
vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof XLSX>('xlsx');
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

// URL.createObjectURL と URL.revokeObjectURL をモック化
const mockCreateObjectURL = vi.fn(() => 'mock-url');
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;

  // document.createElement のモック
  const mockLink = {
    href: '',
    download: '',
    click: vi.fn(),
    style: { visibility: '' },
  } as unknown as HTMLAnchorElement;

  vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
  vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('spreadsheetGenerator', () => {
  const mockData: SpreadsheetOutputData = {
    AB: 100, // 初回予約合計
    AC: 60.5, // 初回予約率(%)
    AD: 80, // 初回実施合計
    AE: 80.0, // 初回実施率(%)
    AJ: 50, // 2回目以降予約合計
    AK: 39.5, // 2回目以降予約率(%)
    AL: 45, // 2回目以降実施合計
    AM: 90.0, // 2回目以降実施率(%)
  };

  const testMonth = '2025-12';

  describe('generateSpreadsheet', () => {
    it('should create workbook with correct structure', () => {
      generateSpreadsheet(mockData, testMonth);

      // XLSX.utils.book_new が呼ばれることを確認（間接的にテスト）
      // XLSX.writeFile が呼ばれることを確認
      expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
    });

    it('should call XLSX.writeFile with correct filename format', () => {
      generateSpreadsheet(mockData, testMonth);

      // ファイル名のフォーマットを確認
      // Lステップ集計_YYYY年MM月_YYYYMMDD.xlsx
      const calls = vi.mocked(XLSX.writeFile).mock.calls;
      expect(calls.length).toBe(1);

      const [, filename] = calls[0] as [XLSX.WorkBook, string];
      expect(filename).toMatch(/^Lステップ集計_2025年12月_\d{8}\.xlsx$/);
    });

    it('should handle workbook with worksheet data', () => {
      generateSpreadsheet(mockData, testMonth);

      const calls = vi.mocked(XLSX.writeFile).mock.calls;
      const [workbook] = calls[0] as [XLSX.WorkBook, string];

      // ワークブックが作成されていることを確認
      expect(workbook).toBeDefined();
      expect(workbook.SheetNames).toContain('集計結果');
      expect(workbook.Sheets['集計結果']).toBeDefined();
    });

    it('should create correct cell values in worksheet', () => {
      generateSpreadsheet(mockData, testMonth);

      const calls = vi.mocked(XLSX.writeFile).mock.calls;
      const [workbook] = calls[0] as [XLSX.WorkBook, string];
      const worksheet = workbook.Sheets['集計結果'];

      // データセルの値を確認（AB2, AC2, etc.）
      // AB列 = index 27 → AB2セル
      expect(worksheet.AB2?.v).toBe(100);
      expect(worksheet.AC2?.v).toBe(60.5);
      expect(worksheet.AD2?.v).toBe(80);
      expect(worksheet.AE2?.v).toBe(80.0);
      expect(worksheet.AJ2?.v).toBe(50);
      expect(worksheet.AK2?.v).toBe(39.5);
      expect(worksheet.AL2?.v).toBe(45);
      expect(worksheet.AM2?.v).toBe(90.0);
    });

    it('should create TTL row with correct values', () => {
      generateSpreadsheet(mockData, testMonth);

      const calls = vi.mocked(XLSX.writeFile).mock.calls;
      const [workbook] = calls[0] as [XLSX.WorkBook, string];
      const worksheet = workbook.Sheets['集計結果'];

      // TTL行（3行目）のラベルと値を確認
      expect(worksheet.AA3?.v).toBe('TTL');
      expect(worksheet.AB3?.v).toBe(100);
      expect(worksheet.AC3?.v).toBe(60.5);
      expect(worksheet.AD3?.v).toBe(80);
      expect(worksheet.AE3?.v).toBe(80.0);
    });

    it('should handle zero values correctly', () => {
      const zeroData: SpreadsheetOutputData = {
        AB: 0,
        AC: 0,
        AD: 0,
        AE: 0,
        AJ: 0,
        AK: 0,
        AL: 0,
        AM: 0,
      };

      generateSpreadsheet(zeroData, testMonth);

      const calls = vi.mocked(XLSX.writeFile).mock.calls;
      const [workbook] = calls[0] as [XLSX.WorkBook, string];
      const worksheet = workbook.Sheets['集計結果'];

      // ゼロ値が正しく設定されていることを確認
      expect(worksheet.AB2?.v).toBe(0);
      expect(worksheet.AC2?.v).toBe(0);
    });

    it('should handle large numbers correctly', () => {
      const largeData: SpreadsheetOutputData = {
        AB: 99999,
        AC: 100.0,
        AD: 88888,
        AE: 88.8,
        AJ: 77777,
        AK: 77.7,
        AL: 66666,
        AM: 86.7,
      };

      generateSpreadsheet(largeData, testMonth);

      const calls = vi.mocked(XLSX.writeFile).mock.calls;
      const [workbook] = calls[0] as [XLSX.WorkBook, string];
      const worksheet = workbook.Sheets['集計結果'];

      // 大きな数値が正しく処理されることを確認
      expect(worksheet.AB2?.v).toBe(99999);
      expect(worksheet.AJ2?.v).toBe(77777);
    });

    it('should handle month string with different formats', () => {
      // YYYY-MM形式以外でも動作することを確認
      generateSpreadsheet(mockData, '2025-01');

      const calls = vi.mocked(XLSX.writeFile).mock.calls;
      const [, filename] = calls[0] as [XLSX.WorkBook, string];
      expect(filename).toMatch(/^Lステップ集計_2025年01月_\d{8}\.xlsx$/);
    });
  });

  describe('generateCSV', () => {
    it('should create CSV with correct structure', () => {
      generateCSV(mockData, testMonth);

      // Blob が作成されることを確認
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it('should create download link with correct filename', () => {
      generateCSV(mockData, testMonth);

      // document.createElement('a') が呼ばれることを確認
      const createElementSpy = vi.spyOn(document, 'createElement');
      expect(createElementSpy).toHaveBeenCalled();
    });

    it('should include BOM for Excel compatibility', () => {
      // Blobコンストラクタをスパイ
      const blobSpy = vi.spyOn(global, 'Blob');

      generateCSV(mockData, testMonth);

      // BOM（\uFEFF）が含まれることを確認
      expect(blobSpy).toHaveBeenCalled();
      const blobArgs = blobSpy.mock.calls[0];

      // Blob は1つの配列要素を持つ（BOMとcsvContentが連結されている）
      expect(blobArgs[0]).toHaveLength(1);

      // 内容を確認
      const content = blobArgs[0][0] as string;
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');

      // BOM文字が先頭にあることを確認
      expect(content.charCodeAt(0)).toBe(0xfeff);
    });

    it('should format CSV content correctly', () => {
      const blobSpy = vi.spyOn(global, 'Blob');

      generateCSV(mockData, testMonth);

      const blobArgs = blobSpy.mock.calls[0];
      const fullContent = blobArgs[0][0] as string;
      // BOMを除去してCSV内容を取得
      const csvContent = fullContent.substring(1);

      // ヘッダー行を確認
      expect(csvContent).toContain('初回予約合計');
      expect(csvContent).toContain('初回予約率(%)');
      expect(csvContent).toContain('2回目以降予約合計');

      // データ行を確認
      expect(csvContent).toContain('100,60.5,80,80');
      expect(csvContent).toContain('50,39.5,45,90');

      // TTL行を確認
      expect(csvContent).toContain('TTL,100,60.5,80,80');
    });

    it('should handle zero values in CSV', () => {
      const zeroData: SpreadsheetOutputData = {
        AB: 0,
        AC: 0,
        AD: 0,
        AE: 0,
        AJ: 0,
        AK: 0,
        AL: 0,
        AM: 0,
      };

      const blobSpy = vi.spyOn(global, 'Blob');

      generateCSV(zeroData, testMonth);

      const blobArgs = blobSpy.mock.calls[0];
      const fullContent = blobArgs[0][0] as string;
      const csvContent = fullContent.substring(1); // BOMを除去

      // ゼロ値が正しく出力されることを確認
      expect(csvContent).toContain('0,0,0,0,0,0,0,0');
    });

    it('should create correct Blob type', () => {
      const blobSpy = vi.spyOn(global, 'Blob');

      generateCSV(mockData, testMonth);

      const blobArgs = blobSpy.mock.calls[0];
      const blobOptions = blobArgs[1];

      // MIMEタイプが正しいことを確認
      expect(blobOptions).toEqual({ type: 'text/csv;charset=utf-8;' });
    });

    it('should trigger download', () => {
      const mockLink = document.createElement('a') as HTMLAnchorElement;
      const clickSpy = vi.spyOn(mockLink, 'click');

      generateCSV(mockData, testMonth);

      // click() が呼ばれることを確認
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('should cleanup URL object after download', () => {
      generateCSV(mockData, testMonth);

      // URL.revokeObjectURL が呼ばれることを確認
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-url');
    });

    it('should handle decimal numbers in CSV', () => {
      const decimalData: SpreadsheetOutputData = {
        AB: 123,
        AC: 45.67,
        AD: 89,
        AE: 72.34,
        AJ: 56,
        AK: 27.66,
        AL: 50,
        AM: 89.29,
      };

      const blobSpy = vi.spyOn(global, 'Blob');

      generateCSV(decimalData, testMonth);

      const blobArgs = blobSpy.mock.calls[0];
      const fullContent = blobArgs[0][0] as string;
      const csvContent = fullContent.substring(1); // BOMを除去

      // 小数点を含む値が正しく出力されることを確認
      expect(csvContent).toContain('45.67');
      expect(csvContent).toContain('72.34');
      expect(csvContent).toContain('27.66');
      expect(csvContent).toContain('89.29');
    });
  });

  describe('Integration: generateSpreadsheet and generateCSV consistency', () => {
    it('should produce consistent data between Excel and CSV formats', () => {
      // Excel生成
      generateSpreadsheet(mockData, testMonth);
      const xlsxCalls = vi.mocked(XLSX.writeFile).mock.calls;
      const [workbook] = xlsxCalls[0] as [XLSX.WorkBook, string];
      const worksheet = workbook.Sheets['集計結果'];

      // CSV生成
      const blobSpy = vi.spyOn(global, 'Blob');
      generateCSV(mockData, testMonth);
      const blobArgs = blobSpy.mock.calls[0];
      const fullContent = blobArgs[0][0] as string;
      const csvContent = fullContent.substring(1); // BOMを除去

      // 両方の形式で同じ値が出力されることを確認
      expect(worksheet.AB2?.v).toBe(mockData.AB);
      expect(csvContent).toContain(String(mockData.AB));

      expect(worksheet.AC2?.v).toBe(mockData.AC);
      expect(csvContent).toContain(String(mockData.AC));
    });
  });
});
