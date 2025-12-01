/**
 * csvParser.ts ユニットテスト
 */
import { describe, it, expect } from 'vitest';
import { validateCSVFile } from './csvParser';

describe('csvParser', () => {
  describe('validateCSVFile', () => {
    it('should accept valid CSV file', () => {
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject non-CSV file', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('CSV');
    });

    it('should reject file larger than 10MB', () => {
      // 10MB + 1バイトのファイル
      const largeContent = 'a'.repeat(10 * 1024 * 1024 + 1);
      const file = new File([largeContent], 'large.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('10MB');
    });

    it('should accept file exactly 10MB', () => {
      // 正確に10MBのファイル
      const content = 'a'.repeat(10 * 1024 * 1024);
      const file = new File([content], 'exact.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject empty CSV file', () => {
      const file = new File([''], 'empty.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('空');
    });
  });
});
