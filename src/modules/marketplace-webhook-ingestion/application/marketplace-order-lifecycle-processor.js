import { MarketplaceWebhookEventKind } from '../domain/marketplace-webhook-event-kind.js';
import {
    MarketplaceWebhookPermanentError,
    MarketplaceWebhookUnsupportedError,
} from './marketplace-webhook-errors.js';
import { MarketplaceOrderIngestionPermanentError, MarketplaceOrderIngestionRetryError, } from '../../marketplace-order-ingestion/public/marketplace-order-ingestion-errors.js';
import {
    MarketplaceOrderLifecyclePermanentError,
    MarketplaceOrderLifecycleRetryError,
} from '../../marketplace-order-ingestion/public/marketplace-order-lifecycle-errors.js';

/**
 * Generic order lifecycle handler for normalized marketplace webhook events (Phase 31/32 boundary).
 * Provider-specific parsing lives in webhook adapters; this class only routes event kinds.
 */
export class MarketplaceOrderLifecycleProcessor {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../marketplace-order-ingestion/application/ingest-normalized-marketplace-order.js').IngestNormalizedMarketplaceOrder} deps.ingestNormalizedMarketplaceOrder
     * @param {import('../../marketplace-order-ingestion/application/process-marketplace-lifecycle-payload.js').ProcessMarketplaceLifecyclePayload} [deps.processMarketplaceLifecyclePayload]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {import('./normalized-marketplace-webhook-event.schema.js').NormalizedMarketplaceWebhookEvent} input.event
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {string|null} [input.correlationId]
     */
    async process(input) {
        const { event } = input;
        if (event.resource.type !== 'order') {
            throw new MarketplaceWebhookUnsupportedError('Webhook resource type is not supported', {
                resourceType: event.resource.type,
            });
        }
        switch (event.eventKind) {
            case MarketplaceWebhookEventKind.ORDER_CREATE:
                return this.ingestOrderCreate(input);
            case MarketplaceWebhookEventKind.ORDER_UPDATE:
                return this.applyOrderUpdate(input);
            default:
                throw new MarketplaceWebhookUnsupportedError('Webhook event kind is not supported', {
                    eventKind: event.eventKind,
                });
        }
    }

    async applyOrderUpdate(input) {
        if (this.deps.processMarketplaceLifecyclePayload === undefined) {
            throw new MarketplaceWebhookUnsupportedError('Order update webhooks require marketplace lifecycle processing', {
                eventKind: input.event.eventKind,
            });
        }
        const lifecyclePayload = input.event.resource.lifecyclePayload;
        try {
            const result = await this.deps.processMarketplaceLifecyclePayload.execute({
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.event.marketplaceKey,
                payload: lifecyclePayload,
                ...(input.correlationId === undefined ? {} : { jobId: input.correlationId }),
            });
            return {
                outcome: result.outcome,
                externalOrderReference: null,
            };
        }
        catch (error) {
            if (error instanceof MarketplaceOrderLifecycleRetryError) {
                throw new MarketplaceOrderIngestionRetryError(error.message, {
                    retryDelayMs: error.retryDelayMs ?? null,
                });
            }
            if (error instanceof MarketplaceOrderLifecyclePermanentError) {
                throw new MarketplaceWebhookPermanentError(error.message, error.safeDetails);
            }
            throw error;
        }
    }

    async ingestOrderCreate(input) {
        try {
            return await this.deps.ingestNormalizedMarketplaceOrder.execute({
                tenantId: input.tenantId,
                channelId: input.channelId,
                normalizedOrder: input.event.resource.order,
                ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
            });
        }
        catch (error) {
            if (error instanceof MarketplaceOrderIngestionRetryError) {
                throw error;
            }
            if (error instanceof MarketplaceOrderIngestionPermanentError) {
                throw new MarketplaceWebhookPermanentError(error.message, error.safeDetails);
            }
            throw error;
        }
    }
}
