import { ValidationError, NotFoundError } from '../../../shared/errors/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { recordMarketplaceLifecycleWorkerOutcome } from '../../../shared/metrics/record-marketplace-lifecycle-worker.js';
import {
    MarketplaceOrderIngestionPermanentError,
    MarketplaceOrderIngestionRetryError,
} from './marketplace-order-ingestion-errors.js';
import {
    MarketplaceOrderLifecyclePermanentError,
    MarketplaceOrderLifecycleRetryError,
    MarketplaceOrderLifecycleUnsupportedError,
} from './marketplace-order-lifecycle-errors.js';
import { marketplaceLifecycleJobSchema } from './marketplace-lifecycle-job.schema.js';

export class ExecuteMarketplaceLifecycleJob {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../marketplace-webhook-ingestion/application/marketplace-order-lifecycle-processor.js').MarketplaceOrderLifecycleProcessor} deps.orderLifecycleProcessor
     * @param {import('./marketplace-order-lifecycle-service.js').MarketplaceOrderLifecycleService} deps.lifecycleService
     * @param {import('../../marketplaces/application/execute-outbound-marketplace-order-lifecycle-command.js').ExecuteOutboundMarketplaceOrderLifecycleCommand} [deps.executeOutboundLifecycle]
     * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('../public/marketplace-channel-lookup.port.js').MarketplaceChannelLookup} deps.marketplaceLookup
     * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
     * @param {import('../../../shared/logging/logger.port.js').Logger} [deps.logger]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {unknown} payload
     * @param {import('../../../infrastructure/queue/bullmq-worker-runtime.js').WorkerJobContext} [context]
     */
    async execute(payload, context) {
        const job = parseOrThrow(marketplaceLifecycleJobSchema, payload, 'marketplace lifecycle job');
        const metricCtx = {
            marketplaceKey: job.marketplaceKey,
            operation: job.operation,
            source: job.source,
        };
        recordMarketplaceLifecycleWorkerOutcome(this.deps.metrics, 'received', metricCtx);
        try {
            await this.assertJobTenantContext(job);
            let result;
            switch (job.processingKind) {
                case 'webhook_event':
                    result = await this.deps.orderLifecycleProcessor.process({
                        event: job.webhookEvent,
                        tenantId: job.tenantId,
                        channelId: job.channelId,
                        ...(job.correlationId === undefined || job.correlationId === null
                            ? {}
                            : { correlationId: job.correlationId }),
                    });
                    break;
                case 'inbound_lifecycle_command':
                    result = await this.deps.lifecycleService.apply({
                        tenantId: job.tenantId,
                        channelId: job.channelId,
                        command: job.command,
                        ...(job.correlationId === undefined || job.correlationId === null
                            ? {}
                            : { jobId: job.correlationId }),
                    });
                    break;
                case 'outbound_lifecycle':
                    if (this.deps.executeOutboundLifecycle === undefined) {
                        throw new MarketplaceOrderLifecyclePermanentError('Outbound marketplace lifecycle is not configured');
                    }
                    result = await this.deps.executeOutboundLifecycle.execute({
                        tenantId: job.tenantId,
                        channelId: job.channelId,
                        marketplaceKey: job.marketplaceKey,
                        externalOrderId: job.externalOrderId,
                        operation: job.lifecycleOperation,
                        idempotencyKey: job.idempotencyKey,
                        payload: job.outboundPayload,
                        correlationId: job.correlationId ?? null,
                    });
                    break;
                default:
                    throw new MarketplaceOrderLifecyclePermanentError('Unknown marketplace lifecycle job kind');
            }
            recordMarketplaceLifecycleWorkerOutcome(this.deps.metrics, 'completed', metricCtx);
            this.deps.logger?.info({
                tenantId: job.tenantId,
                channelId: job.channelId,
                marketplaceKey: job.marketplaceKey,
                externalOrderId: job.externalOrderId,
                externalEventId: job.externalEventId,
                operation: job.operation,
                source: job.source,
                outcome: result?.outcome ?? 'completed',
                attempt: context?.attempt,
                ...(job.correlationId === undefined || job.correlationId === null
                    ? {}
                    : { correlationId: job.correlationId }),
            }, 'Marketplace lifecycle job completed');
            return result;
        }
        catch (error) {
            if (error instanceof MarketplaceOrderLifecycleRetryError
                || error instanceof MarketplaceOrderIngestionRetryError) {
                recordMarketplaceLifecycleWorkerOutcome(this.deps.metrics, 'retried', metricCtx);
                const retryDelayMs = error.retryDelayMs ?? null;
                if (retryDelayMs !== null
                    && retryDelayMs > 0
                    && context !== undefined
                    && typeof context.moveToDelayed === 'function') {
                    await context.moveToDelayed(retryDelayMs);
                    return;
                }
                throw error;
            }
            if (error instanceof MarketplaceOrderLifecycleUnsupportedError) {
                recordMarketplaceLifecycleWorkerOutcome(this.deps.metrics, 'unsupported', metricCtx);
                this.logPermanentFailure(job, error, context);
                return;
            }
            if (error instanceof MarketplaceOrderLifecyclePermanentError
                || error instanceof MarketplaceOrderIngestionPermanentError
                || error instanceof ValidationError
                || error instanceof NotFoundError) {
                recordMarketplaceLifecycleWorkerOutcome(this.deps.metrics, 'permanent_failure', metricCtx);
                this.logPermanentFailure(job, error, context);
                return;
            }
            recordMarketplaceLifecycleWorkerOutcome(this.deps.metrics, 'retried', metricCtx);
            throw error;
        }
    }

    /**
     * @param {import('./marketplace-lifecycle-job.schema.js').MarketplaceLifecycleJob} job
     */
    async assertJobTenantContext(job) {
        const channel = await this.deps.channelQueryService.getChannelById(job.tenantId, job.channelId);
        if (channel.tenantId !== job.tenantId) {
            throw new MarketplaceOrderLifecyclePermanentError('Channel tenant mismatch', {
                channelId: job.channelId,
            });
        }
        const marketplace = await this.deps.marketplaceLookup.findById(channel.marketplaceId);
        if (marketplace === null) {
            throw new MarketplaceOrderLifecyclePermanentError('Channel marketplace was not found', {
                marketplaceId: channel.marketplaceId,
            });
        }
        if (marketplace.key !== job.marketplaceKey) {
            throw new MarketplaceOrderLifecyclePermanentError('Lifecycle job marketplaceKey does not match channel', {
                expected: marketplace.key,
                received: job.marketplaceKey,
            });
        }
    }

    /**
     * @param {import('./marketplace-lifecycle-job.schema.js').MarketplaceLifecycleJob} job
     * @param {Error} error
     * @param {import('../../../infrastructure/queue/bullmq-worker-runtime.js').WorkerJobContext} [context]
     */
    logPermanentFailure(job, error, context) {
        this.deps.logger?.warn({
            tenantId: job.tenantId,
            channelId: job.channelId,
            marketplaceKey: job.marketplaceKey,
            externalOrderId: job.externalOrderId,
            externalEventId: job.externalEventId,
            operation: job.operation,
            source: job.source,
            errorType: error.name,
            err: error.message,
            attempt: context?.attempt,
            maxAttempts: context?.maxAttempts,
            ...(job.correlationId === undefined || job.correlationId === null
                ? {}
                : { correlationId: job.correlationId }),
        }, 'Marketplace lifecycle job permanently failed');
    }
}
