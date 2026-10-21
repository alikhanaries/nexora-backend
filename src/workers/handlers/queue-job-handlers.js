/**
 * Registers BullMQ job handlers on the worker runtime.
 *
 * Maps each queue/job name to validated payload handling: integration events
 * (inbox router), webhook delivery, catalog sync, and marketplace lifecycle.
 */
import { z } from 'zod';
import { JobName, QueueName } from '../../infrastructure/queue/queue-names.js';
import { WebhookDeliveryRetryError } from '../../modules/webhooks/outbound/services/webhook-delivery-errors.js';
import { CatalogSyncRetryError } from '../../modules/integration-catalog-sync/services/catalog-sync-errors.js';
import { parseOrThrow } from '../../shared/validation/index.js';
const integrationEventPayloadSchema = z.object({
    eventId: z.string().uuid(),
    eventType: z.string(),
    eventVersion: z.number().int(),
    aggregateType: z.string(),
    aggregateId: z.string(),
    tenantId: z.string().uuid().nullable(),
    payload: z.record(z.unknown()),
    occurredAt: z.string(),
    correlationId: z.string().nullable(),
});
const webhookDeliveryPayloadSchema = z.object({
    tenantId: z.string().uuid(),
    deliveryId: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    eventId: z.string().uuid(),
    eventType: z.string(),
});
/**
 * Binds domain services to the queues the worker process consumes.
 *
 * @param {object} deps
 * @param {import('../../infrastructure/queue/bullmq-worker-runtime.js').BullMqWorkerRuntime} deps.workerRuntime
 * @param {import('./composite-integration-event-router.js').CompositeIntegrationEventRouter} deps.integrationEventRouter
 * @param {import('../../modules/webhooks/outbound/services/webhook-delivery-service.js').WebhookDeliveryService} deps.webhookDeliveryService
 * @param {import('../../modules/integration-catalog-sync/services/integration-catalog-sync-service.js').IntegrationCatalogSyncService} deps.channelCatalogSyncService
 * @param {import('../../modules/orders/marketplace-ingestion/services/execute-marketplace-lifecycle-job.js').ExecuteMarketplaceLifecycleJob} deps.executeMarketplaceLifecycleJob
 * @param {string} deps.marketplaceLifecycleQueueName
 */
export function registerWorkerHandlers(deps) {
    if (deps.channelCatalogSyncService === undefined) {
        throw new Error('channelCatalogSyncService is required for worker handlers');
    }
    if (deps.executeMarketplaceLifecycleJob === undefined) {
        throw new Error('executeMarketplaceLifecycleJob is required for worker handlers');
    }
    /** Validates outbox job payload and routes through integration event consumers. */
    const publishHandler = async (payload, context) => {
        if (context.name !== JobName.PUBLISH_INTEGRATION_EVENT) {
            return;
        }
        const parsed = parseOrThrow(integrationEventPayloadSchema, payload, 'integration event job');
        await deps.integrationEventRouter.route({
            id: parsed.eventId,
            type: parsed.eventType,
            version: parsed.eventVersion,
            aggregateType: parsed.aggregateType,
            aggregateId: parsed.aggregateId,
            tenantId: parsed.tenantId,
            payload: parsed.payload,
            occurredAt: new Date(parsed.occurredAt),
            correlationId: parsed.correlationId,
        });
    };
    /** Performs outbound webhook HTTP delivery with optional BullMQ delayed retry. */
    const webhookDeliveryHandler = async (payload, context) => {
        if (context.name !== JobName.DELIVER_WEBHOOK) {
            return;
        }
        const parsed = parseOrThrow(webhookDeliveryPayloadSchema, payload, 'webhook delivery job');
        try {
            await deps.webhookDeliveryService.deliver(parsed, context);
        }
        catch (error) {
            if (error instanceof WebhookDeliveryRetryError
                && error.retryDelayMs !== null
                && error.retryDelayMs > 0
                && typeof context.moveToDelayed === 'function') {
                await context.moveToDelayed(error.retryDelayMs);
                return;
            }
            throw error;
        }
    };
    /** Runs channel catalog sync worker job with delayed retry on {@link CatalogSyncRetryError}. */
    const catalogSyncHandler = async (payload, context) => {
        if (context.name !== JobName.RUN_CATALOG_SYNC) {
            return;
        }
        try {
            await deps.channelCatalogSyncService.processSyncJob(payload);
        }
        catch (error) {
            if (error instanceof CatalogSyncRetryError
                && error.retryDelayMs !== null
                && error.retryDelayMs > 0
                && typeof context.moveToDelayed === 'function') {
                await context.moveToDelayed(error.retryDelayMs);
                return;
            }
            throw error;
        }
    };
    /** Delegates marketplace order lifecycle queue jobs to the domain executor. */
    const marketplaceLifecycleHandler = async (payload, context) => {
        if (context.name !== JobName.PROCESS_MARKETPLACE_LIFECYCLE) {
            return;
        }
        await deps.executeMarketplaceLifecycleJob.execute(payload, context);
    };
    deps.workerRuntime.register(QueueName.INTEGRATION_EVENTS, publishHandler);
    deps.workerRuntime.register(QueueName.WEBHOOK_DELIVERIES, webhookDeliveryHandler);
    deps.workerRuntime.register(QueueName.CHANNEL_CATALOG_SYNC, catalogSyncHandler);
    deps.workerRuntime.register(deps.marketplaceLifecycleQueueName, marketplaceLifecycleHandler);
}
