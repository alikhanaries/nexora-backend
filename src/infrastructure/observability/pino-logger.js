/**
 * Factory for the structured logging adapter used across API and worker processes.
 */
import { pino } from 'pino';
import { currentContextLogFields } from '../../shared/context/request-context.js';
import { PINO_REDACT_PATHS } from '../../shared/logging/index.js';
/**
 * Pino-backed implementation of the Logger port.
 *
 * Request correlation is automatic: every record is enriched from the
 * AsyncLocalStorage request context, so callers never have to remember to pass
 * `requestId`. Once authentication exists, `tenantId` and `userId` start
 * appearing with no change at any call site.
 */
class PinoLoggerAdapter {
    instance;
    /** @param {import('pino').Logger} instance */
    constructor(instance) {
        this.instance = instance;
    }
    /** Log at trace level with request-context enrichment. */
    trace(fields, message) {
        this.instance.trace(this.enrich(fields), message);
    }
    /** Log at debug level with request-context enrichment. */
    debug(fields, message) {
        this.instance.debug(this.enrich(fields), message);
    }
    /** Log at info level with request-context enrichment. */
    info(fields, message) {
        this.instance.info(this.enrich(fields), message);
    }
    /** Log at warn level with request-context enrichment. */
    warn(fields, message) {
        this.instance.warn(this.enrich(fields), message);
    }
    /** Log at error level with request-context enrichment. */
    error(fields, message) {
        this.instance.error(this.enrich(fields), message);
    }
    /** Log at fatal level with request-context enrichment. */
    fatal(fields, message) {
        this.instance.fatal(this.enrich(fields), message);
    }
    /** Returns a child logger with fixed binding fields. */
    child(fields) {
        return new PinoLoggerAdapter(this.instance.child(fields));
    }
    /** Waits for buffered log records to be written (shutdown). */
    flush() {
        return new Promise((resolve) => {
            this.instance.flush(() => {
                resolve();
            });
        });
    }
    /** Merges AsyncLocalStorage request context fields into log payload. */
    enrich(fields) {
        return { ...currentContextLogFields(), ...fields };
    }
}
/** Pino options from app config (level, redaction, pretty transport in dev). */
function buildOptions(config) {
    const base = {
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
    if (!config.observability.logPretty)
        return base;
    return {
        ...base,
        transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
        },
    };
}
/** Builds a {@link ../../shared/logging/logger.port.js} from observability config. */
export function createPinoLogger(config) {
    if (config.observability.logLevel === 'silent') {
        return new PinoLoggerAdapter(pino({ level: 'silent' }));
    }
    return new PinoLoggerAdapter(pino(buildOptions(config)));
}
