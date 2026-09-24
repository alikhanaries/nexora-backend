import { z } from 'zod';
import { JobName, QueueName } from '../../infrastructure/queue/queue-names.js';
import { WebhookDeliveryRetryError } from '../../modules/webhooks/application/webhook-delivery-errors.js';
import { CatalogSyncRetryError } from '../../modules/channel-catalog-sync/application/catalog-sync-errors.js';
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
export function registerWorkerHandlers(deps) {
    if (deps.channelCatalogSyncService === undefined) {
        throw new Error('channelCatalogSyncService is required for worker handlers');
    }
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
    deps.workerRuntime.register(QueueName.INTEGRATION_EVENTS, publishHandler);
    deps.workerRuntime.register(QueueName.WEBHOOK_DELIVERIES, webhookDeliveryHandler);
    deps.workerRuntime.register(QueueName.CHANNEL_CATALOG_SYNC, catalogSyncHandler);
}
