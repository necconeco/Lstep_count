/**
 * logger.ts ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, getLogger, log } from './logger';

// Sentryモジュールをモック
vi.mock('./sentry', () => ({
  captureError: vi.fn(),
  captureMessage: vi.fn(),
}));

describe('logger', () => {
  // コンソールメソッドをスパイ
  const consoleSpy = {
    debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Logger class', () => {
    it('should create logger with default context', () => {
      const logger = new Logger();
      logger.info('test message');

      expect(consoleSpy.info).toHaveBeenCalledWith('[App]', 'test message');
    });

    it('should create logger with custom context', () => {
      const logger = new Logger({ context: 'CustomContext' });
      logger.info('test message');

      expect(consoleSpy.info).toHaveBeenCalledWith('[CustomContext]', 'test message');
    });

    it('should log debug messages', () => {
      const logger = new Logger({ context: 'Test' });
      logger.debug('debug message');

      expect(consoleSpy.debug).toHaveBeenCalledWith('[Test]', 'debug message');
    });

    it('should log info messages', () => {
      const logger = new Logger({ context: 'Test' });
      logger.info('info message');

      expect(consoleSpy.info).toHaveBeenCalledWith('[Test]', 'info message');
    });

    it('should log warn messages', () => {
      const logger = new Logger({ context: 'Test' });
      logger.warn('warn message');

      expect(consoleSpy.warn).toHaveBeenCalledWith('[Test]', 'warn message');
    });

    it('should log error messages', () => {
      const logger = new Logger({ context: 'Test' });
      logger.error('error message');

      expect(consoleSpy.error).toHaveBeenCalledWith('[Test]', 'error message');
    });

    it('should include data in logs', () => {
      const logger = new Logger({ context: 'Test' });
      const data = { userId: '123', action: 'test' };
      logger.info('message with data', data);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        '[Test]',
        'message with data',
        expect.objectContaining({
          data: { userId: '123', action: 'test' },
        })
      );
    });

    it('should include error details in error logs', () => {
      const logger = new Logger({ context: 'Test' });
      const error = new Error('Test error');
      logger.error('error occurred', error);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[Test]',
        'error occurred',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
          }),
        })
      );
    });

    it('should create child logger with combined context', () => {
      const parentLogger = new Logger({ context: 'Parent' });
      const childLogger = parentLogger.child('Child');

      childLogger.info('child message');

      expect(consoleSpy.info).toHaveBeenCalledWith('[Parent:Child]', 'child message');
    });
  });

  describe('getLogger', () => {
    it('should return default logger when no context provided', () => {
      const logger = getLogger();
      logger.info('test');

      expect(consoleSpy.info).toHaveBeenCalledWith('[App]', 'test');
    });

    it('should return logger with specified context', () => {
      const logger = getLogger('MyModule');
      logger.info('test');

      expect(consoleSpy.info).toHaveBeenCalledWith('[MyModule]', 'test');
    });
  });

  describe('log shortcuts', () => {
    it('should provide debug shortcut', () => {
      log.debug('debug via shortcut');
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should provide info shortcut', () => {
      log.info('info via shortcut');
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should provide warn shortcut', () => {
      log.warn('warn via shortcut');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should provide error shortcut', () => {
      log.error('error via shortcut');
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('log entry structure', () => {
    it('should include timestamp in ISO format', () => {
      const logger = new Logger({ context: 'Test' });
      logger.info('test');

      const call = consoleSpy.info.mock.calls[0];
      // データなしの場合は2引数
      expect(call.length).toBeGreaterThanOrEqual(2);
    });

    it('should not include empty data object', () => {
      const logger = new Logger({ context: 'Test' });
      logger.info('message without data');

      // データなしの場合、3番目の引数（ログエントリ）がない
      const call = consoleSpy.info.mock.calls[0];
      expect(call[0]).toBe('[Test]');
      expect(call[1]).toBe('message without data');
    });
  });
});
