import { requireChannelStockLocationId } from '../../channels/public/index.js';
import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from '../../channel-catalog-sync/public/catalog-sync-adapter-errors.js';
import { mapMarketplaceErrorToAdapterError } from '../../marketplaces/public/index.js';
import { INGESTIBLE_MARKETPLACE_ORDER_STATUSES } from '../domain/normalized-marketplace-order-status.js';
import {
    MarketplaceOrderIngestionPermanentError,
    MarketplaceOrderIngestionRetryError,
} from './marketplace-order-ingestion-errors.js';

const DEFAULT_MAX_PAGES = 1;

/**
 * Bounded Shopify/marketplace order polling: list via adapter, ingest through generic pipeline.
 */
export class FetchAndIngestMarketplaceOrders {
    deps;

    /**
     * @param {object} deps
     * @param {import('./ingest-normalized-marketplace-order.js').IngestNormalizedMarketplaceOrder} deps.ingestNormalizedMarketplaceOrder
     * @param {import('../public/marketplace-order-adapter-registry.js').MarketplaceOrderAdapterRegistry} deps.orderAdapterRegistry
     * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} deps.marketplaceAdapterRuntimeFactory
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
     * @param {number} [input.first]
     * @param {string|null} [input.after]
     * @param {string|null} [input.query]
     * @param {number} [input.maxPages]
     * @param {string|null} [input.correlationId]
     * @param {string} [input.jobId]
     */
    async execute(input) {
        const adapter = this.deps.orderAdapterRegistry.resolve(input.marketplaceKey);
        if (adapter === null || typeof adapter.listOrders !== 'function') {
            throw new MarketplaceOrderIngestionPermanentError('Marketplace order polling is not supported', {
                marketplaceKey: input.marketplaceKey,
            });
        }
        const caps = adapter.getOrderCapabilities?.();
        if (caps?.supportsOrderPolling !== true) {
            throw new MarketplaceOrderIngestionPermanentError('Marketplace does not support order polling', {
                marketplaceKey: input.marketplaceKey,
            });
        }
        const channel = await this.deps.channelQueryService.getChannelById(input.tenantId, input.channelId);
        if (channel.tenantId !== input.tenantId) {
            throw new MarketplaceOrderIngestionPermanentError('Channel tenant mismatch', {
                channelId: input.channelId,
            });
        }
        const stockLocationId = requireChannelStockLocationId(channel);
        const maxPages = Math.max(1, Math.trunc(input.maxPages ?? DEFAULT_MAX_PAGES));
        const first = input.first ?? 50;
        let after = input.after ?? null;
        let pagesFetched = 0;
        /** @type {Array<{ externalOrderId: string, outcome: string, orderId?: string }>} */
        const results = [];
        let skippedNonIngestible = 0;
        let hasNextPage = false;
        let endCursor = null;
        try {
            while (pagesFetched < maxPages) {
                const page = await this.fetchPage(input, adapter, stockLocationId, first, after);
                pagesFetched += 1;
                hasNextPage = page.hasNextPage;
                endCursor = page.endCursor;
                for (const order of page.orders) {
                    if (!INGESTIBLE_MARKETPLACE_ORDER_STATUSES.has(order.status)) {
                        skippedNonIngestible += 1;
                        continue;
                    }
                    const ingestResult = await this.deps.ingestNormalizedMarketplaceOrder.execute({
                        tenantId: input.tenantId,
                        channelId: input.channelId,
                        marketplaceKey: input.marketplaceKey,
                        normalizedOrder: order,
                        ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
                        ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
                    });
                    results.push({
                        externalOrderId: order.externalOrderId,
                        outcome: ingestResult.outcome,
                        orderId: ingestResult.order.id,
                    });
                }
                if (!page.hasNextPage || page.endCursor === null) {
                    break;
                }
                after = page.endCursor;
            }
            return {
                pagesFetched,
                hasNextPage,
                endCursor,
                skippedNonIngestible,
                results,
            };
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
            if (error instanceof MarketplaceOrderIngestionPermanentError ||
                error instanceof MarketplaceOrderIngestionRetryError) {
                throw error;
            }
            throw mapped;
        }
    }

    /**
     * @param {object} input
     * @param {import('../public/marketplace-order-adapter.port.js').MarketplaceOrderAdapter} adapter
     * @param {string} stockLocationId
     * @param {number} first
     * @param {string|null} after
     */
    async fetchPage(input, adapter, stockLocationId, first, after) {
        return this.deps.database.execute(async (tx) => {
            const runtime = await this.deps.marketplaceAdapterRuntimeFactory.createForSync({
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
                tx,
            });
            return adapter.listOrders(runtime, {
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
                stockLocationId,
                correlationId: input.correlationId ?? null,
            }, {
                first,
                after,
                ...(input.query === undefined ? {} : { query: input.query }),
            });
        }, { tenantId: input.tenantId });
    }
}
