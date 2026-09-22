import { InboxConsumer } from '../infrastructure/postgres/inbox-consumer.js';
import { CompositeIntegrationEventRouter } from './handlers/composite-integration-event-router.js';
import { LoggingIntegrationEventHandler } from './handlers/integration-event.handler.js';
import { WebhookDispatchEnqueueHandler } from './handlers/webhook-dispatch-enqueue.handler.js';

/**
 * @param {object} deps
 * @param {import('../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../infrastructure/postgres/inbox-repository.js').PostgresInboxRepository} deps.inbox
 * @param {import('../shared/logging/logger.port.js').Logger} deps.logger
 * @param {import('../modules/webhooks/application/webhook-dispatch-service.js').WebhookDispatchService} deps.webhookDispatchService
 */
export function createIntegrationEventConsumers(deps) {
    const loggingHandler = new LoggingIntegrationEventHandler(deps.logger);
    const webhookHandler = new WebhookDispatchEnqueueHandler(deps.webhookDispatchService);
    const consumers = [
        new InboxConsumer(deps.database, deps.inbox, loggingHandler, deps.logger),
        new InboxConsumer(deps.database, deps.inbox, webhookHandler, deps.logger),
    ];
    const integrationEventRouter = new CompositeIntegrationEventRouter(consumers);
    return {
        integrationEventRouter,
        loggingHandler,
        webhookHandler,
        consumers,
    };
}
