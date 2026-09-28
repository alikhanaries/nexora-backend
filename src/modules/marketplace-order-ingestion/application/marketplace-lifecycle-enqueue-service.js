import { JobName } from '../../../infrastructure/queue/queue-names.js';
import { MarketplaceLifecycleJobSource } from '../domain/marketplace-lifecycle-job-source.js';
import { buildMarketplaceLifecycleJobId } from './build-marketplace-lifecycle-job-id.js';
import {
    deriveMarketplaceLifecycleWebhookOperation,
    externalOrderIdFromWebhookEvent,
} from '../../marketplace-webhook-ingestion/application/derive-marketplace-lifecycle-webhook-operation.js';

export class MarketplaceLifecycleEnqueueService {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../../shared/queue/job-queue.port.js').JobQueue} deps.queue
     * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
     * @param {import('../../../app/config/config.js').AppConfig['marketplaceLifecycle']} deps.lifecycleConfig
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {import('../../marketplace-webhook-ingestion/application/normalized-marketplace-webhook-event.schema.js').NormalizedMarketplaceWebhookEvent} input.event
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {string|null} [input.correlationId]
     */
    async enqueueFromWebhook(input) {
        const { event } = input;
        const operation = deriveMarketplaceLifecycleWebhookOperation(event);
        const externalEventId = event.providerEventId ?? event.deduplicationKey;
        const externalOrderId = externalOrderIdFromWebhookEvent(event);
        return this.enqueue({
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
    async enqueueInboundCommand(input) {
        const { command } = input;
        return this.enqueue({
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
    async enqueueOutboundCommand(input) {
        return this.enqueue({
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
    async enqueue(job) {
        const jobId = buildMarketplaceLifecycleJobId({
            channelId: job.channelId,
            marketplaceKey: job.marketplaceKey,
            externalEventId: job.externalEventId,
            operation: job.operation,
        });
        const queueName = this.deps.lifecycleConfig.queueName;
        const payload = {
            ...job,
            receivedAt: new Date().toISOString(),
        };
        const enqueued = await this.deps.queue.enqueue(
            queueName,
            JobName.PROCESS_MARKETPLACE_LIFECYCLE,
            payload,
            {
                jobId,
                attempts: this.deps.lifecycleConfig.jobAttempts,
            },
        );
        this.deps.metrics?.recordMarketplaceLifecycleWorker?.({
            outcome: 'enqueued',
            marketplace: job.marketplaceKey,
            operation: job.operation,
            source: job.source,
        });
        return enqueued;
    }
}
