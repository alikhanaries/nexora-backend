import type {
  IntegrationEventHandler,
  ReceivedIntegrationEvent,
} from '../../shared/events/index.js';
import type { Logger } from '../../shared/logging/index.js';

/**
 * Phase 1 consumer: logs the event.
 *
 * Business handlers arrive in later phases. This proves the inbox + worker
 * pipeline delivers events at-least-once without duplicating effects.
 */
export class LoggingIntegrationEventHandler implements IntegrationEventHandler {
  readonly consumerName = 'foundation.logging';

  constructor(private readonly logger: Logger) {}

  handle(event: ReceivedIntegrationEvent): Promise<void> {
    this.logger.info(
      {
        eventId: event.id,
        eventType: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
      },
      'Integration event consumed',
    );
    return Promise.resolve();
  }
}
