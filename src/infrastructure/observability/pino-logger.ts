import { pino, type Logger as PinoLoggerInstance, type LoggerOptions } from 'pino';
import type { AppConfig } from '../../shared/config/index.js';
import { currentContextLogFields } from '../../shared/context/request-context.js';
import type { LogFields, Logger } from '../../shared/logging/index.js';
import { PINO_REDACT_PATHS } from '../../shared/logging/index.js';

/**
 * Pino-backed implementation of the Logger port.
 *
 * Request correlation is automatic: every record is enriched from the
 * AsyncLocalStorage request context, so callers never have to remember to pass
 * `requestId`. Once authentication exists, `tenantId` and `userId` start
 * appearing with no change at any call site.
 */
class PinoLoggerAdapter implements Logger {
  constructor(private readonly instance: PinoLoggerInstance) {}

  trace(fields: LogFields, message: string): void {
    this.instance.trace(this.enrich(fields), message);
  }

  debug(fields: LogFields, message: string): void {
    this.instance.debug(this.enrich(fields), message);
  }

  info(fields: LogFields, message: string): void {
    this.instance.info(this.enrich(fields), message);
  }

  warn(fields: LogFields, message: string): void {
    this.instance.warn(this.enrich(fields), message);
  }

  error(fields: LogFields, message: string): void {
    this.instance.error(this.enrich(fields), message);
  }

  fatal(fields: LogFields, message: string): void {
    this.instance.fatal(this.enrich(fields), message);
  }

  child(fields: LogFields): Logger {
    return new PinoLoggerAdapter(this.instance.child(fields));
  }

  flush(): Promise<void> {
    return new Promise((resolve) => {
      this.instance.flush(() => {
        resolve();
      });
    });
  }

  private enrich(fields: LogFields): Record<string, unknown> {
    return { ...currentContextLogFields(), ...fields };
  }
}

function buildOptions(config: AppConfig): LoggerOptions {
  const base: LoggerOptions = {
    level: config.observability.logLevel,
    // `pid`/`hostname` are noise in a container scheduler; service identity is
    // what actually helps when reading aggregated logs.
    base: { service: config.appName, env: config.env },
    redact: { paths: [...PINO_REDACT_PATHS], censor: '[REDACTED]' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      // Emit `"level":"info"` rather than `"level":30`, which most log
      // backends index without extra configuration.
      level: (label) => ({ level: label }),
    },
  };

  if (!config.observability.logPretty) return base;

  return {
    ...base,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
    },
  };
}

export function createPinoLogger(config: AppConfig): Logger {
  if (config.observability.logLevel === 'silent') {
    return new PinoLoggerAdapter(pino({ level: 'silent' }));
  }
  return new PinoLoggerAdapter(pino(buildOptions(config)));
}
