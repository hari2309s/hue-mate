import { AppError, isOperationalError } from './errors';

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

interface LogMetadata {
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: LogMetadata;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
    isOperational?: boolean;
  };
}

const colors = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[35m',
  reset: '\x1b[0m',
};

const icons = {
  info: '→',
  success: '✓',
  warn: '⚠',
  error: '✗',
  debug: '◆',
};

class Logger {
  private isDevelopment: boolean;
  private logLevel: LogLevel;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'success', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatError(error: Error | AppError): LogEntry['error'] {
    const errorData: LogEntry['error'] = {
      name: error.name,
      message: error.message,
    };

    if (error instanceof AppError) {
      errorData.code = error.code;
      errorData.isOperational = error.isOperational;
    }

    if (this.isDevelopment || !isOperationalError(error)) {
      errorData.stack = error.stack;
    }

    return errorData;
  }

  private log(level: LogLevel, message: string, meta?: LogMetadata): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const color = colors[level];
    const icon = icons[level];
    const prefix = `${color}${icon}${colors.reset}`;

    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
      ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
    };

    if (this.isDevelopment) {
      console.log(`[${timestamp}] ${prefix} ${message}`);
      if (meta && Object.keys(meta).length > 0) {
        console.log(JSON.stringify(meta, null, 2));
      }
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  info(message: string, meta?: LogMetadata): void {
    this.log('info', message, meta);
  }

  success(message: string, meta?: LogMetadata): void {
    this.log('success', message, meta);
  }

  warn(message: string, meta?: LogMetadata): void {
    this.log('warn', message, meta);
  }

  debug(message: string, meta?: LogMetadata): void {
    this.log('debug', message, meta);
  }

  error(message: string | Error, meta?: LogMetadata): void {
    if (message instanceof Error) {
      const errorEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: message.message,
        error: this.formatError(message),
        ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
      };

      if (this.isDevelopment) {
        console.error(
          `[${errorEntry.timestamp}] ${colors.error}${icons.error}${colors.reset} ${message.message}`
        );
        if (errorEntry.error?.stack) {
          console.error(errorEntry.error.stack);
        }
        if (meta && Object.keys(meta).length > 0) {
          console.error(JSON.stringify(meta, null, 2));
        }
      } else {
        console.error(JSON.stringify(errorEntry));
      }
    } else {
      this.log('error', message, meta);
    }
  }

  performance(operation: string, durationMs: number, meta?: LogMetadata): void {
    this.info(`Performance: ${operation}`, {
      durationMs,
      ...meta,
    });
  }
}

export const logger = new Logger();
export { Logger };
