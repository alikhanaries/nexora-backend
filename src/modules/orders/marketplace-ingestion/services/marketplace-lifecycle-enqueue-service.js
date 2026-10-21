import { JobName } from '../../../../infrastructure/queue/queue-names.js';
import { MarketplaceLifecycleJobSource } from '../models/marketplace-lifecycle-job-source.js';
import { buildMarketplaceLifecycleJobId } from './build-marketplace-lifecycle-job-id.js';
import {
    deriveMarketplaceLifecycleWebhookOperation,
    externalOrderIdFromWebhookEvent,
} from '../../../webhooks/marketplace/services/derive-marketplace-lifecycle-webhook-operation.js';

/**
 * @param {object} deps
 * @returns {{ enqueue: Function }}
 */
export function createMarketplaceLifecycleEnqueueService(deps) {
    /**
     * @param {object} input
     * @param {import('../../../webhooks/marketplace/services/normalized-marketplace-webhook-event.schema.js').NormalizedMarketplaceWebhookEvent} input.event
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {string|null} [input.correlationId]
     */
    async function enqueueFromWebhook(input) {
        const { event } = input;
        const operation = deriveMarketplaceLifecycleWebhookOperation(event);
        const externalEventId = event.providerEventId ?? event.deduplicationKey;
        const externalOrderId = externalOrderIdFromWebhookEvent(event);
        return enqueue({
            tenantId: input.tenantId,
            channelId: input.channelId,
            marketplaceKey: event.marketplaceKey,
            externalOrderId,
            externalEventId,
            operation,
            source: MarketplaceLifecycleJobSource.WEBHOOK,
            processingKind: 'webhook_event',
            webhookEvent: event,
            ...(input.correlationId === undefined || input.correlationId === null
                ? {}
                : { correlationId: input.correlationId }),
        });
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {import('./normalized-marketplace-lifecycle-command.schema.js').normalizedMarketplaceLifecycleCommandSchema['_output']} input.command
     * @param {string|null} [input.correlationId]
     */
    async function enqueueInboundCommand(input) {
        const { command } = input;
        return enqueue({
            tenantId: input.tenantId,
            channelId: input.channelId,
            marketplaceKey: command.marketplaceKey,
            externalOrderId: command.externalOrderId,
            externalEventId: command.externalEventId,
            operation: command.operation,
            source: MarketplaceLifecycleJobSource.POLLING,
            processingKind: 'inbound_lifecycle_command',
            command,
            ...(input.correlationId === undefined || input.correlationId === null
                ? {}
                : { correlationId: input.correlationId }),
        });
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {string} input.marketplaceKey
     * @param {string} input.externalOrderId
     * @param {string} input.operation
     * @param {string} input.idempotencyKey
     * @param {unknown} [input.payload]
     * @param {string|null} [input.correlationId]
     */
    async function enqueueOutboundCommand(input) {
        return enqueue({
            tenantId: input.tenantId,
            channelId: input.channelId,
            marketplaceKey: input.marketplaceKey,
            externalOrderId: input.externalOrderId,
            externalEventId: input.idempotencyKey,
            operation: input.operation,
            source: MarketplaceLifecycleJobSource.OUTBOUND,
            processingKind: 'outbound_lifecycle',
            idempotencyKey: input.idempotencyKey,
            lifecycleOperation: input.operation,
            outboundPayload: input.payload,
            ...(input.correlationId === undefined || input.correlationId === null
                ? {}
                : { correlationId: input.correlationId }),
        });
    }

    /**
     * @param {object} job
     */
    async function enqueue(job) {
        const jobId = buildMarketplaceLifecycleJobId({
            channelId: job.channelId,
            marketplaceKey: job.marketplaceKey,
            externalEventId: job.externalEventId,
            operation: job.operation,
        });
        const queueName = deps.lifecycleConfig.queueName;
        const payload = {
            ...job,
            receivedAt: new Date().toISOString(),
        };
        const enqueued = await deps.queue.enqueue(
            queueName,
            JobName.PROCESS_MARKETPLACE_LIFECYCLE,
            payload,
            {
                jobId,
                attempts: deps.lifecycleConfig.jobAttempts,
            },
        );
        deps.metrics?.recordMarketplaceLifecycleWorker?.({
            outcome: 'enqueued',
            marketplace: job.marketplaceKey,
            operation: job.operation,
            source: job.source,
        });
        return enqueued;
    }
    return {
        enqueue,
        enqueueFromWebhook,
        enqueueInboundCommand,
        enqueueOutboundCommand,
    };
}
