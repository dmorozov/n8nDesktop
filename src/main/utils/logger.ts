/**
 * Structured logging utility for Docling service (T073).
 *
 * Provides JSON-formatted log output for debugging and monitoring.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  module: string;
  traceId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

/**
 * Create a structured log entry with JSON format.
 */
function createLogEntry(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    module,
    ...data,
  };
}

/**
 * Format log entry as JSON string.
 */
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Structured logger for a specific module.
 */
export class Logger {
  private module: string;
  private traceId?: string;
  private correlationId?: string;

  constructor(module: string) {
    this.module = module;
  }

  /**
   * Create a child logger with bound context.
   */
  bind(context: { traceId?: string; correlationId?: string }): Logger {
    const child = new Logger(this.module);
    child.traceId = context.traceId ?? this.traceId;
    child.correlationId = context.correlationId ?? this.correlationId;
    return child;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry = createLogEntry(level, this.module, message, {
      ...data,
      ...(this.traceId && { traceId: this.traceId }),
      ...(this.correlationId && { correlationId: this.correlationId }),
    });
    const formatted = formatLogEntry(entry);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }
}

/**
 * Get a logger for a specific module.
 */
export function getLogger(module: string): Logger {
  return new Logger(module);
}

/**
 * Format a log message with timestamp for storage.
 */
export function formatLogMessage(message: string, traceId?: string): string {
  const timestamp = new Date().toISOString();
  if (traceId) {
    return `[${timestamp}] [${traceId}] ${message.trim()}`;
  }
  return `[${timestamp}] ${message.trim()}`;
}
