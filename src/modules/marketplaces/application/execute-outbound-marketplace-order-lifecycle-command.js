import { fingerprintRequest } from '../../../shared/idempotency/index.js';
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
        const capabilityKey = capabilityForOperation(input.operation);
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
            return this.deps.database.execute(async (tx) => {
                const runtime = await this.deps.marketplaceAdapterRuntimeFactory.createForSync({
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                    marketplaceKey: input.marketplaceKey,
                    tx,
                });
                return invokeAdapter(adapter, runtime, context, input);
            }, { tenantId: input.tenantId });
        };
        if (this.deps.idempotency === undefined) {
            return run();
        }
        const outcome = await this.deps.idempotency.execute(idempotencyKey, fingerprint, run, (value) => ({
            statusCode: 200,
            body: value,
        }));
        const payload = outcome.kind === 'replayed' ? outcome.value : outcome.value;
        return payload?.body ?? payload;
    }
}

/**
 * @param {string} operation
 */
function capabilityForOperation(operation) {
    switch (operation) {
        case MarketplaceOrderLifecycleOperation.CANCEL_ORDER:
            return 'supportsOutboundCancellation';
        case MarketplaceOrderLifecycleOperation.REFUND_ORDER:
            return 'supportsOutboundRefund';
        case MarketplaceOrderLifecycleOperation.FULFILL_ORDER:
            return 'supportsOutboundFulfillment';
        default:
            throw new MarketplaceOrderLifecycleUnsupportedError(operation, 'unknown');
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
