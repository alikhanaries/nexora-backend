/**
 * Builds inbox-backed integration event consumers for the worker process.
 *
 * Each handler gets its own {@link InboxConsumer} so deduplication stays
 * per consumer name, then a router fans the same event through the pipeline.
 */
import { InboxConsumer } from '../infrastructure/postgres/inbox-consumer.js';
import { CompositeIntegrationEventRouter } from './handlers/composite-integration-event-router.js';
import { LoggingIntegrationEventHandler } from './handlers/integration-event.handler.js';
import { WebhookDispatchEnqueueHandler } from './handlers/webhook-dispatch-enqueue.handler.js';

/**
 * Wires the composite router used when integration events are published from the outbox.
 *
 * @param {object} deps
 * @param {import('../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../infrastructure/postgres/inbox-repository.js').PostgresInboxRepository} deps.inbox
 * @param {import('../shared/logging/logger.port.js').Logger} deps.logger
 * @param {import('../modules/webhooks/outbound/services/webhook-dispatch-service.js').WebhookDispatchService} deps.webhookDispatchService
 * @param {import('./handlers/catalog-sync-enqueue.handler.js').CatalogSyncEnqueueHandler} [deps.catalogSyncEnqueueHandler]
 */
export function createIntegrationEventConsumers(deps) {
    const loggingHandler = new LoggingIntegrationEventHandler(deps.logger);
    const webhookHandler = new WebhookDispatchEnqueueHandler(deps.webhookDispatchService);
    const consumers = [
        new InboxConsumer(deps.database, deps.inbox, loggingHandler, deps.logger),
        new InboxConsumer(deps.database, deps.inbox, webhookHandler, deps.logger),
    ];
    if (deps.catalogSyncEnqueueHandler !== undefined) {
        consumers.push(new InboxConsumer(deps.database, deps.inbox, deps.catalogSyncEnqueueHandler, deps.logger));
    }
    const integrationEventRouter = new CompositeIntegrationEventRouter(consumers);
    return {
        integrationEventRouter,
        loggingHandler,
        webhookHandler,
        consumers,
    };
}
