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
    constructor(instance) {
        this.instance = instance;
    }
    trace(fields, message) {
        this.instance.trace(this.enrich(fields), message);
    }
    debug(fields, message) {
        this.instance.debug(this.enrich(fields), message);
    }
    info(fields, message) {
        this.instance.info(this.enrich(fields), message);
    }
    warn(fields, message) {
        this.instance.warn(this.enrich(fields), message);
    }
    error(fields, message) {
        this.instance.error(this.enrich(fields), message);
    }
    fatal(fields, message) {
        this.instance.fatal(this.enrich(fields), message);
    }
    child(fields) {
        return new PinoLoggerAdapter(this.instance.child(fields));
    }
    flush() {
        return new Promise((resolve) => {
            this.instance.flush(() => {
                resolve();
            });
        });
    }
    enrich(fields) {
        return { ...currentContextLogFields(), ...fields };
    }
}
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
export function createPinoLogger(config) {
    if (config.observability.logLevel === 'silent') {
        return new PinoLoggerAdapter(pino({ level: 'silent' }));
    }
    return new PinoLoggerAdapter(pino(buildOptions(config)));
}
