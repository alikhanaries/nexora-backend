/**
 * Phase 1 consumer: logs the event.
 *
 * Business handlers arrive in later phases. This proves the inbox + worker
 * pipeline delivers events at-least-once without duplicating effects.
 */
export class LoggingIntegrationEventHandler {
    logger;
    consumerName = 'foundation.logging';
    /** @param {import('../../shared/logging/logger.port.js').Logger} logger */
    constructor(logger) {
        this.logger = logger;
    }
    /** Logs consumed integration event metadata (pipeline smoke handler). */
    handle(event) {
        this.logger.info({
            eventId: event.id,
            eventType: event.type,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
        }, 'Integration event consumed');
        return Promise.resolve();
    }
}
