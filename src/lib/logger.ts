export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogTag =
  | 'app'
  | 'api'
  | 'cors'
  | 'schedule'
  | 'drift'
  | 'conflict'
  | 'status'
  | 'fixture'
  | 'pwa'
  | 'storage';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  tag: LogTag;
  message: string;
  data?: unknown;
}

const RING_CAPACITY = 200;
const ring: LogEntry[] = [];

function push(entry: LogEntry) {
  ring.push(entry);
  if (ring.length > RING_CAPACITY) ring.shift();
}

const consoleMethod: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function emit(level: LogLevel, tag: LogTag, message: string, data?: unknown) {
  const entry: LogEntry = { timestamp: Date.now(), level, tag, message, data };
  push(entry);
  const prefix = `[${tag}]`;
  if (data !== undefined) {
    consoleMethod[level](prefix, message, data);
  } else {
    consoleMethod[level](prefix, message);
  }
}

export const logger = {
  debug: (tag: LogTag, message: string, data?: unknown) => emit('debug', tag, message, data),
  info: (tag: LogTag, message: string, data?: unknown) => emit('info', tag, message, data),
  warn: (tag: LogTag, message: string, data?: unknown) => emit('warn', tag, message, data),
  error: (tag: LogTag, message: string, data?: unknown) => emit('error', tag, message, data),
  snapshot: (): LogEntry[] => ring.slice(),
  clear: () => {
    ring.length = 0;
  },
};

if (typeof window !== 'undefined') {
  // Diagnostics global — read-only handle for tests + the in-app DiagnosticsPanel.
  (window as unknown as { __diag: unknown }).__diag = {
    logs: () => logger.snapshot(),
    clear: () => logger.clear(),
    exportLogs: () => JSON.stringify(logger.snapshot(), null, 2),
  };
}
