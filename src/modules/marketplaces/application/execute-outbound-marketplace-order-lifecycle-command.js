import { fingerprintRequest } from '../../../shared/idempotency/index.js';
import { recordMarketplaceOrderLifecycleOutcome } from '../../../shared/metrics/record-marketplace-order-lifecycle.js';
import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from '../../channel-catalog-sync/public/catalog-sync-adapter-errors.js';
import { MarketplaceOrderLifecycleOperation } from '../../marketplace-order-ingestion/index.js';
import {
    MarketplaceOrderLifecyclePermanentError,
    MarketplaceOrderLifecycleRetryError,
    MarketplaceOrderLifecycleUnsupportedError,
} from '../../marketplace-order-ingestion/public/marketplace-order-lifecycle-errors.js';
import { mapMarketplaceErrorToAdapterError } from '../public/index.js';

const ROUTE_ID = 'marketplace-order-lifecycle/outbound';

/**
 * Outbound marketplace order lifecycle (provider HTTP via adapter; no Nexora order mutation here).
 */
export class ExecuteOutboundMarketplaceOrderLifecycleCommand {
    deps;

    /**
     * @param {object} deps
     * @param {import('./marketplace-outbound-order-lifecycle-adapter-registry.js').MarketplaceOutboundOrderLifecycleAdapterRegistry} deps.lifecycleAdapterRegistry
     * @param {import('../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} deps.marketplaceAdapterRuntimeFactory
     * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
     * @param {import('../../../infrastructure/postgres/idempotency-service.js').PostgresIdempotencyService} [deps.idempotency]
     * @param {import('../../channels/public/index.js').DefaultChannelQueryService} [deps.channelQueryService]
     * @param {import('../../marketplace-order-ingestion/public/marketplace-channel-lookup.port.js').MarketplaceChannelLookup} [deps.marketplaceLookup]
     * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
     * @param {import('../../../shared/logging/logger.port.js').Logger} [deps.logger]
     */
    constructor(deps) {
        this.deps = deps;
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
    async execute(input) {
        const metricContext = {
            marketplaceKey: input.marketplaceKey,
            operation: input.operation,
        };
        recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, 'outbound_received', metricContext);
        try {
            if (this.deps.channelQueryService !== undefined && this.deps.marketplaceLookup !== undefined) {
                await this.assertChannelContext(input.tenantId, input.channelId, input.marketplaceKey);
            }
            const capabilityKey = capabilityForOperation(input.operation, input.marketplaceKey);
            const adapter = this.deps.lifecycleAdapterRegistry.requireAdapter(input.marketplaceKey, capabilityKey);
            const context = {
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
                externalOrderId: input.externalOrderId,
                correlationId: input.correlationId ?? null,
            };
            const principalFingerprint = `marketplace-lifecycle:${input.channelId}:${input.marketplaceKey}`;
            const idempotencyKey = {
                tenantId: input.tenantId,
                principalFingerprint,
                routeId: ROUTE_ID,
                idempotencyKey: input.idempotencyKey,
            };
            const fingerprint = fingerprintRequest({
                operation: input.operation,
                externalOrderId: input.externalOrderId,
                payload: input.payload ?? null,
            });
            const run = async () => {
                const runtime = await this.deps.database.execute(async (tx) => this.deps.marketplaceAdapterRuntimeFactory.createForSync({
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                    marketplaceKey: input.marketplaceKey,
                    tx,
                }), { tenantId: input.tenantId });
                return invokeAdapter(adapter, runtime, context, input);
            };
            let result;
            if (this.deps.idempotency === undefined) {
                result = await run();
            }
            else {
                const outcome = await this.deps.idempotency.execute(idempotencyKey, fingerprint, run, (value) => ({
                    statusCode: 200,
                    body: value,
                }));
                const payload = outcome.value;
                result = payload?.body ?? payload;
            }
            recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, result.outcome ?? 'outbound_success', metricContext);
            this.deps.logger?.info({
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
                externalOrderId: input.externalOrderId,
                operation: input.operation,
                idempotencyKey: input.idempotencyKey,
                outcome: result.outcome,
                provider: input.marketplaceKey,
                ...(input.correlationId === undefined || input.correlationId === null
                    ? {}
                    : { correlationId: input.correlationId }),
            }, 'Marketplace outbound order lifecycle executed');
            return result;
        }
        catch (error) {
            if (error instanceof MarketplaceOrderLifecycleUnsupportedError) {
                recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, 'unsupported', metricContext);
                throw error;
            }
            if (error instanceof MarketplaceOrderLifecyclePermanentError) {
                recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, 'permanent_failure', metricContext);
                throw error;
            }
            if (error instanceof MarketplaceOrderLifecycleRetryError) {
                recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, 'retryable_failure', metricContext);
                throw error;
            }
            recordMarketplaceOrderLifecycleOutcome(this.deps.metrics, 'retryable_failure', metricContext);
            throw error;
        }
    }

    /**
     * @param {string} tenantId
     * @param {string} channelId
     * @param {string} marketplaceKey
     */
    async assertChannelContext(tenantId, channelId, marketplaceKey) {
        const channelQueryService = this.deps.channelQueryService;
        const marketplaceLookup = this.deps.marketplaceLookup;
        if (channelQueryService === undefined || marketplaceLookup === undefined) {
            return;
        }
        const channel = await channelQueryService.getChannelById(tenantId, channelId);
        if (channel.tenantId !== tenantId) {
            throw new MarketplaceOrderLifecyclePermanentError('Channel tenant mismatch', { channelId });
        }
        const marketplace = await marketplaceLookup.findById(channel.marketplaceId);
        if (marketplace === null) {
            throw new MarketplaceOrderLifecyclePermanentError('Channel marketplace was not found', {
                marketplaceId: channel.marketplaceId,
            });
        }
        if (marketplace.key !== marketplaceKey) {
            throw new MarketplaceOrderLifecyclePermanentError('Lifecycle command marketplaceKey does not match channel', {
                expected: marketplace.key,
                received: marketplaceKey,
            });
        }
    }
}

/**
 * @param {string} operation
 */
function capabilityForOperation(operation, marketplaceKey) {
    switch (operation) {
        case MarketplaceOrderLifecycleOperation.CANCEL_ORDER:
            return 'supportsOutboundCancellation';
        case MarketplaceOrderLifecycleOperation.REFUND_ORDER:
            return 'supportsOutboundRefund';
        case MarketplaceOrderLifecycleOperation.FULFILL_ORDER:
            return 'supportsOutboundFulfillment';
        case MarketplaceOrderLifecycleOperation.RETURN_ORDER:
            return 'supportsOutboundReturns';
        default:
            throw new MarketplaceOrderLifecycleUnsupportedError(operation, marketplaceKey);
    }
}

/**
 * @param {import('../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOutboundOrderLifecycleAdapter} adapter
 * @param {import('../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
 * @param {import('../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOutboundOrderLifecycleContext} context
 * @param {object} input
 */
async function invokeAdapter(adapter, runtime, context, input) {
    try {
        switch (input.operation) {
            case MarketplaceOrderLifecycleOperation.CANCEL_ORDER:
                if (typeof adapter.cancelOrder !== 'function') {
                    throw new MarketplaceOrderLifecycleUnsupportedError(input.operation, input.marketplaceKey);
                }
                return adapter.cancelOrder(runtime, context, /** @type {import('../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOrderCancelRequest} */ (input.payload ?? {}));
            case MarketplaceOrderLifecycleOperation.REFUND_ORDER:
                if (typeof adapter.refundOrder !== 'function') {
                    throw new MarketplaceOrderLifecycleUnsupportedError(input.operation, input.marketplaceKey);
                }
                return adapter.refundOrder(runtime, context, /** @type {import('../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOrderRefundRequest} */ (input.payload ?? {}));
            case MarketplaceOrderLifecycleOperation.FULFILL_ORDER:
                if (typeof adapter.createFulfillment !== 'function') {
                    throw new MarketplaceOrderLifecycleUnsupportedError(input.operation, input.marketplaceKey);
                }
                return adapter.createFulfillment(runtime, context, /** @type {import('../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceCreateFulfillmentRequest} */ (input.payload ?? {}));
            default:
                throw new MarketplaceOrderLifecycleUnsupportedError(input.operation, input.marketplaceKey);
        }
    }
    catch (error) {
        const mapped = mapMarketplaceErrorToAdapterError(error);
        if (mapped instanceof MarketplaceCatalogAdapterRetryError) {
            throw new MarketplaceOrderLifecycleRetryError(mapped.message, mapped.safeDetails, mapped.retryDelayMs ?? null);
        }
        if (mapped instanceof MarketplaceCatalogAdapterPermanentError) {
            throw new MarketplaceOrderLifecyclePermanentError(mapped.message, mapped.safeDetails);
        }
        if (error instanceof MarketplaceOrderLifecyclePermanentError || error instanceof MarketplaceOrderLifecycleUnsupportedError) {
            throw error;
        }
        throw new MarketplaceOrderLifecyclePermanentError('Marketplace order lifecycle command failed', {
            operation: input.operation,
        });
    }
}
