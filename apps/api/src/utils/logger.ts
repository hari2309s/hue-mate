type LogLevel = 'info' | 'success' | 'warn' | 'error';

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

function log(level: LogLevel, message: string): void {
  const timestamp = new Date().toISOString();
  const color = colors[level];
  const icon = icons[level];
  const prefix = `${color}${icon}${colors.reset}`;

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

export const logger = {
  info: (message: string) => log('info', message),
  success: (message: string) => log('success', message),
  warn: (message: string) => log('warn', message),
  error: (message: string | Error) => {
    const msg = message instanceof Error ? message.message : message;
    log('error', msg);
  },
};
