/**
 * 構造化ログユーティリティ
 *
 * JSON形式でログを出力し、本番環境では適切なレベルでフィルタリングします。
 * Sentryとの連携もサポートします。
 */

import { captureError, captureMessage } from './sentry';

// ログレベル
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ログレベルの優先度
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 現在のログレベル（本番では 'warn' 以上のみ出力）
const CURRENT_LOG_LEVEL: LogLevel = import.meta.env.PROD ? 'warn' : 'debug';

// ログエントリの型
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// ロガーオプション
export interface LoggerOptions {
  context?: string;
  sendToSentry?: boolean;
}

/**
 * ログエントリを作成
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
  error?: Error,
  context?: string
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context) {
    entry.context = context;
  }

  if (data && Object.keys(data).length > 0) {
    entry.data = data;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return entry;
}

/**
 * ログを出力すべきかチェック
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[CURRENT_LOG_LEVEL];
}

/**
 * コンソールにログを出力
 */
function outputToConsole(entry: LogEntry): void {
  const prefix = `[${entry.context || 'App'}]`;
  const logData = entry.data || entry.error ? entry : undefined;

  /* eslint-disable no-console */
  switch (entry.level) {
    case 'debug':
      if (logData) {
        console.debug(prefix, entry.message, logData);
      } else {
        console.debug(prefix, entry.message);
      }
      break;
    case 'info':
      if (logData) {
        console.info(prefix, entry.message, logData);
      } else {
        console.info(prefix, entry.message);
      }
      break;
    case 'warn':
      if (logData) {
        console.warn(prefix, entry.message, logData);
      } else {
        console.warn(prefix, entry.message);
      }
      break;
    case 'error':
      if (logData) {
        console.error(prefix, entry.message, logData);
      } else {
        console.error(prefix, entry.message);
      }
      break;
  }
  /* eslint-enable no-console */
}

/**
 * ロガークラス
 */
export class Logger {
  private context: string;
  private sendToSentry: boolean;

  constructor(options: LoggerOptions = {}) {
    this.context = options.context || 'App';
    this.sendToSentry = options.sendToSentry ?? true;
  }

  /**
   * デバッグログ
   */
  debug(message: string, data?: Record<string, unknown>): void {
    if (!shouldLog('debug')) return;

    const entry = createLogEntry('debug', message, data, undefined, this.context);
    outputToConsole(entry);
  }

  /**
   * 情報ログ
   */
  info(message: string, data?: Record<string, unknown>): void {
    if (!shouldLog('info')) return;

    const entry = createLogEntry('info', message, data, undefined, this.context);
    outputToConsole(entry);
  }

  /**
   * 警告ログ
   */
  warn(message: string, data?: Record<string, unknown>): void {
    if (!shouldLog('warn')) return;

    const entry = createLogEntry('warn', message, data, undefined, this.context);
    outputToConsole(entry);

    // Sentryにも送信（警告レベル）
    if (this.sendToSentry && import.meta.env.PROD) {
      captureMessage(`[${this.context}] ${message}`, 'warning');
    }
  }

  /**
   * エラーログ
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    if (!shouldLog('error')) return;

    const errorObj = error instanceof Error ? error : undefined;
    const entry = createLogEntry('error', message, data, errorObj, this.context);
    outputToConsole(entry);

    // Sentryにも送信
    if (this.sendToSentry) {
      if (errorObj) {
        captureError(errorObj, { context: this.context, message, ...data });
      } else {
        captureMessage(`[${this.context}] ${message}`, 'error');
      }
    }
  }

  /**
   * 子ロガーを作成（コンテキストを追加）
   */
  child(childContext: string): Logger {
    return new Logger({
      context: `${this.context}:${childContext}`,
      sendToSentry: this.sendToSentry,
    });
  }
}

// デフォルトのロガーインスタンス
const defaultLogger = new Logger();

/**
 * デフォルトロガーを取得
 */
export function getLogger(context?: string): Logger {
  if (context) {
    return new Logger({ context });
  }
  return defaultLogger;
}

// 便利なショートカット関数
export const log = {
  debug: (message: string, data?: Record<string, unknown>) => defaultLogger.debug(message, data),
  info: (message: string, data?: Record<string, unknown>) => defaultLogger.info(message, data),
  warn: (message: string, data?: Record<string, unknown>) => defaultLogger.warn(message, data),
  error: (message: string, error?: Error | unknown, data?: Record<string, unknown>) =>
    defaultLogger.error(message, error, data),
};
