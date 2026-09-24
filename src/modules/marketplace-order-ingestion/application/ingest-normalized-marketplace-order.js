import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from '../../channel-catalog-sync/public/catalog-sync-adapter-errors.js';
import { mapMarketplaceErrorToAdapterError } from '../../marketplaces/public/index.js';
import {
    MarketplaceOrderIngestionPermanentError,
    MarketplaceOrderIngestionRetryError,
} from './marketplace-order-ingestion-errors.js';

/**
 * Fetch or accept a normalized order, then run generic ingestion.
 * Webhook and polling entrypoints converge here.
 */
export class IngestNormalizedMarketplaceOrder {
    deps;

    /**
     * @param {object} deps
     * @param {import('./marketplace-order-ingestion-service.js').MarketplaceOrderIngestionService} deps.ingestionService
     * @param {import('../public/marketplace-order-adapter-registry.js').MarketplaceOrderAdapterRegistry} deps.orderAdapterRegistry
     * @param {import('../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} [deps.marketplaceAdapterRuntimeFactory]
     * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {string} input.marketplaceKey
     * @param {unknown} [input.normalizedOrder]
     * @param {string} [input.externalOrderId]
     * @param {string|null} [input.correlationId]
     * @param {string} [input.jobId]
     */
    async execute(input) {
        let order = input.normalizedOrder;
        if (order === undefined) {
            if (input.externalOrderId === undefined || input.externalOrderId.trim().length === 0) {
                throw new MarketplaceOrderIngestionPermanentError('externalOrderId or normalizedOrder is required');
            }
            order = await this.fetchViaAdapter(input);
        }
        return this.deps.ingestionService.ingest({
            tenantId: input.tenantId,
            channelId: input.channelId,
            order,
            ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
            ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
        });
    }

    /**
     * @param {object} input
     */
    async fetchViaAdapter(input) {
        const adapter = this.deps.orderAdapterRegistry.resolve(input.marketplaceKey);
        if (adapter === null || typeof adapter.fetchOrder !== 'function') {
            throw new MarketplaceOrderIngestionPermanentError('Marketplace order fetch is not supported', {
                marketplaceKey: input.marketplaceKey,
            });
        }
        const caps = adapter.getOrderCapabilities?.();
        if (caps?.supportsOrdersInbound !== true) {
            throw new MarketplaceOrderIngestionPermanentError('Marketplace does not support inbound orders', {
                marketplaceKey: input.marketplaceKey,
            });
        }
        if (this.deps.marketplaceAdapterRuntimeFactory === undefined) {
            throw new MarketplaceOrderIngestionPermanentError('Marketplace adapter runtime is not configured');
        }
        try {
            return await this.deps.database.execute(async (tx) => {
                const runtime = await this.deps.marketplaceAdapterRuntimeFactory.createForSync({
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                    marketplaceKey: input.marketplaceKey,
                    tx,
                });
                return adapter.fetchOrder(runtime, {
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                    marketplaceKey: input.marketplaceKey,
                    externalOrderId: input.externalOrderId,
                    correlationId: input.correlationId ?? null,
                });
            }, { tenantId: input.tenantId });
        }
        catch (error) {
            const mapped = mapMarketplaceErrorToAdapterError(error);
            if (mapped instanceof MarketplaceCatalogAdapterRetryError) {
                throw new MarketplaceOrderIngestionRetryError(mapped.message, {
                    retryDelayMs: mapped.retryDelayMs ?? 5_000,
                });
            }
            if (mapped instanceof MarketplaceCatalogAdapterPermanentError) {
                throw new MarketplaceOrderIngestionPermanentError(mapped.message, mapped.safeDetails);
            }
            throw mapped;
        }
    }
}
