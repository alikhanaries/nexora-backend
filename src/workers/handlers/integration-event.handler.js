/**
 * Phase 1 consumer: logs the event.
 *
 * Business handlers arrive in later phases. This proves the inbox + worker
 * pipeline delivers events at-least-once without duplicating effects.
 */
export class LoggingIntegrationEventHandler {
    logger;
    consumerName = 'foundation.logging';
    constructor(logger) {
        this.logger = logger;
    }
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
