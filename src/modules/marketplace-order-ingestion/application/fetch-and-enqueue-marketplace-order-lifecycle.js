import { mapMarketplaceErrorToAdapterError } from '../../marketplaces/public/index.js';
import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from '../../channel-catalog-sync/public/catalog-sync-adapter-errors.js';
import {
    MarketplaceOrderIngestionPermanentError,
    MarketplaceOrderIngestionRetryError,
} from './marketplace-order-ingestion-errors.js';

/**
 * Polls a single order lifecycle command via the order adapter and enqueues worker processing.
 */
export class FetchAndEnqueueMarketplaceOrderLifecycle {
    deps;

    /**
     * @param {object} deps
     * @param {import('./marketplace-lifecycle-enqueue-service.js').MarketplaceLifecycleEnqueueService} deps.lifecycleEnqueueService
     * @param {import('../public/marketplace-order-adapter-registry.js').MarketplaceOrderAdapterRegistry} deps.orderAdapterRegistry
     * @param {import('../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} deps.marketplaceAdapterRuntimeFactory
     * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
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
     * @param {string} input.externalOrderId
     * @param {string} input.externalEventId
     * @param {string|null} [input.correlationId]
     */
    async execute(input) {
        const adapter = this.deps.orderAdapterRegistry.resolve(input.marketplaceKey);
        if (adapter === null || typeof adapter.fetchOrderLifecycleCommand !== 'function') {
            throw new MarketplaceOrderIngestionPermanentError('Marketplace order lifecycle polling is not supported', {
                marketplaceKey: input.marketplaceKey,
            });
        }
        const channel = await this.deps.channelQueryService.getChannelById(input.tenantId, input.channelId);
        if (channel.tenantId !== input.tenantId) {
            throw new MarketplaceOrderIngestionPermanentError('Channel tenant mismatch', {
                channelId: input.channelId,
            });
        }
        try {
            const command = await this.deps.database.execute(async (tx) => {
                const runtime = await this.deps.marketplaceAdapterRuntimeFactory.createForSync({
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                    marketplaceKey: input.marketplaceKey,
                    tx,
                });
                return adapter.fetchOrderLifecycleCommand(runtime, {
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                    marketplaceKey: input.marketplaceKey,
                    externalOrderId: input.externalOrderId,
                    correlationId: input.correlationId ?? null,
                }, input.externalEventId);
            }, { tenantId: input.tenantId });
            return this.deps.lifecycleEnqueueService.enqueueInboundCommand({
                tenantId: input.tenantId,
                channelId: input.channelId,
                command,
                correlationId: input.correlationId ?? null,
            });
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
            if (error instanceof MarketplaceOrderIngestionPermanentError
                || error instanceof MarketplaceOrderIngestionRetryError) {
                throw error;
            }
            throw mapped;
        }
    }
}
