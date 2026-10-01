/**
 * Forwards Nest internal logs to the existing Pino logger.
 */
export class NestLoggerService {
  constructor(logger) {
    this.logger = logger.child({ component: 'nest' });
  }

  log(message, context) {
    this.logger.info({ context }, message);
  }

  error(message, trace, context) {
    this.logger.error({ context, trace }, message);
  }

  warn(message, context) {
    this.logger.warn({ context }, message);
  }

  debug(message, context) {
    this.logger.debug({ context }, message);
  }

  verbose(message, context) {
    this.logger.trace({ context }, message);
  }
}
