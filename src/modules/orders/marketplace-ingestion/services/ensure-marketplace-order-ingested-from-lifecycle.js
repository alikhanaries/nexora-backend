import { requireChannelStockLocationId } from '../../../commerce-integrations/public/index.js';
import { MarketplaceOrderLifecyclePermanentError } from './marketplace-order-lifecycle-errors.js';

/**
 * Creates a Wasl order when a lifecycle command references a marketplace order
 * that is not yet ingested (Amazon/Noon/Namshi first-event path).
 */
export class EnsureMarketplaceOrderIngestedFromLifecycle {
    deps;

    /**
     * @param {object} deps
     * @param {import('./ingest-normalized-marketplace-order.js').IngestNormalizedMarketplaceOrder} deps.ingestNormalizedMarketplaceOrder
     * @param {import('../public/marketplace-order-adapter-registry.js').MarketplaceOrderAdapterRegistry} deps.orderAdapterRegistry
     * @param {import('../../../commerce-integrations/public/commerce-integration-query-service.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
     * @param {{ findByChannelAndExternalReference: Function }} deps.orders
     * @param {import('../../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
     * @param {import('../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} [deps.marketplaceAdapterRuntimeFactory]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {string} input.marketplaceKey
     * @param {unknown} input.payload
     * @param {import('./normalized-marketplace-lifecycle-command.schema.js').normalizedMarketplaceLifecycleCommandSchema['_output']} input.command
     * @param {string} [input.jobId]
     */
    async execute(input) {
        const externalOrderReference = input.command.externalOrderId.trim();
        const existing = await this.deps.database.execute(async (tx) => this.deps.orders.findByChannelAndExternalReference(
            tx,
            input.tenantId,
            input.channelId,
            externalOrderReference,
        ), { tenantId: input.tenantId });
        if (existing !== null) {
            return { ingested: false, orderId: existing.id };
        }
        const adapter = this.deps.orderAdapterRegistry.resolve(input.marketplaceKey);
        if (adapter === null || typeof adapter.normalizeOrderFromLifecyclePayload !== 'function') {
            throw new MarketplaceOrderLifecyclePermanentError('Marketplace order was not found in Wasl', {
                externalOrderId: externalOrderReference,
                channelId: input.channelId,
            });
        }
        const channel = await this.deps.commerceIntegrationQueryService.getCommerceIntegrationById(input.tenantId, input.channelId);
        const stockLocationId = requireChannelStockLocationId(channel);
        let runtime;
        if (this.deps.marketplaceAdapterRuntimeFactory !== undefined) {
            runtime = await this.deps.database.execute(async (tx) => this.deps.marketplaceAdapterRuntimeFactory.createForSync({
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
                tx,
            }), { tenantId: input.tenantId });
        }
        const normalizedOrder = await adapter.normalizeOrderFromLifecyclePayload(input.payload, runtime, {
            tenantId: input.tenantId,
            channelId: input.channelId,
            marketplaceKey: input.marketplaceKey,
            stockLocationId,
            externalOrderId: externalOrderReference,
        });
        const result = await this.deps.ingestNormalizedMarketplaceOrder.execute({
            tenantId: input.tenantId,
            channelId: input.channelId,
            marketplaceKey: input.marketplaceKey,
            normalizedOrder,
            ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
        });
        return { ingested: true, orderId: result.order.id, ingestionOutcome: result.outcome };
    }
}
