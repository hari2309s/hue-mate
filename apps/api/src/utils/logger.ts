type LogLevel = 'info' | 'success' | 'warn' | 'error';

interface LogMetadata {
  [key: string]: any;
}

const colors = {
  info: '\x1b[36m', // cyan
  success: '\x1b[32m', // green
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
  reset: '\x1b[0m',
};

const icons = {
  info: '→',
  success: '✓',
  warn: '⚠',
  error: '✗',
};

function log(level: LogLevel, message: string, meta?: LogMetadata): void {
  const timestamp = new Date().toISOString();
  const color = colors[level];
  const icon = icons[level];
  const prefix = `${color}${icon}${colors.reset}`;

  const logEntry: any = {
    timestamp,
    level,
    message,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };

  // For development, pretty print
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${timestamp}] ${prefix} ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  } else {
    // For production, output structured JSON
    console.log(JSON.stringify(logEntry));
  }
}

export const logger = {
  info: (message: string, meta?: LogMetadata) => log('info', message, meta),
  success: (message: string, meta?: LogMetadata) => log('success', message, meta),
  warn: (message: string, meta?: LogMetadata) => log('warn', message, meta),
  error: (message: string | Error, meta?: LogMetadata) => {
    const msg = message instanceof Error ? message.message : message;
    log('error', msg, {
      ...meta,
      ...(message instanceof Error && { stack: message.stack }),
    });
  },
};
