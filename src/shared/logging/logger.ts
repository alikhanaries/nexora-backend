/**
 * Logging port.
 *
 * Application and (future) domain-adjacent code depends on this interface, not
 * on Pino. The Pino implementation lives in
 * src/infrastructure/observability/pino-logger.ts.
 */
export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  trace(fields: LogFields, message: string): void;
  debug(fields: LogFields, message: string): void;
  info(fields: LogFields, message: string): void;
  warn(fields: LogFields, message: string): void;
  error(fields: LogFields, message: string): void;
  fatal(fields: LogFields, message: string): void;
  /** Returns a logger that adds `fields` to every record. */
  child(fields: LogFields): Logger;
  /** Flushes buffered records; called during graceful shutdown. */
  flush(): Promise<void>;
}

/** No-op logger for unit tests and code paths that must never emit output. */
export const silentLogger: Logger = {
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  child: () => silentLogger,
  flush: () => Promise.resolve(),
};
