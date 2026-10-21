/**
 * Forwards Nest internal logs to the existing Pino logger.
 */
export class NestLoggerService {
  /** @param {import('../../infrastructure/observability/pino-logger.js').PinoLogger} logger */
  constructor(logger) {
    this.logger = logger.child({ component: 'nest' });
  }

  /** Nest `log` → Pino info. */
  log(message, context) {
    this.logger.info({ context }, message);
  }

  /** Nest `error` → Pino error (includes optional stack trace). */
  error(message, trace, context) {
    this.logger.error({ context, trace }, message);
  }

  /** Nest `warn` → Pino warn. */
  warn(message, context) {
    this.logger.warn({ context }, message);
  }

  /** Nest `debug` → Pino debug. */
  debug(message, context) {
    this.logger.debug({ context }, message);
  }

  /** Nest `verbose` → Pino trace. */
  verbose(message, context) {
    this.logger.trace({ context }, message);
  }
}
