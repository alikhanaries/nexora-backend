import { requireChannelStockLocationId } from '../../../commerce-integrations/public/index.js';
import { MarketplaceOrderLifecyclePermanentError } from './marketplace-order-lifecycle-errors.js';

/**
 * Creates a Wasl order when a lifecycle command references a marketplace order
 * that is not yet ingested (Amazon/Noon/Namshi first-event path).
 */
/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createEnsureMarketplaceOrderIngestedFromLifecycle(deps) {
    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {string} input.marketplaceKey
     * @param {unknown} input.payload
     * @param {import('./normalized-marketplace-lifecycle-command.schema.js').normalizedMarketplaceLifecycleCommandSchema['_output']} input.command
     * @param {string} [input.jobId]
     */
    async function execute(input) {
        const externalOrderReference = input.command.externalOrderId.trim();
        const existing = await deps.database.execute(async (tx) => deps.orders.findByChannelAndExternalReference(
            tx,
            input.tenantId,
            input.channelId,
            externalOrderReference,
        ), { tenantId: input.tenantId });
        if (existing !== null) {
            return { ingested: false, orderId: existing.id };
        }
        const adapter = deps.orderAdapterRegistry.resolve(input.marketplaceKey);
        if (adapter === null || typeof adapter.normalizeOrderFromLifecyclePayload !== 'function') {
            throw new MarketplaceOrderLifecyclePermanentError('Marketplace order was not found in Wasl', {
                externalOrderId: externalOrderReference,
                channelId: input.channelId,
            });
        }
        const channel = await deps.commerceIntegrationQueryService.getCommerceIntegrationById(input.tenantId, input.channelId);
        const stockLocationId = requireChannelStockLocationId(channel);
        let runtime;
        if (deps.marketplaceAdapterRuntimeFactory !== undefined) {
            runtime = await deps.database.execute(async (tx) => deps.marketplaceAdapterRuntimeFactory.createForSync({
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
        const result = await deps.ingestNormalizedMarketplaceOrder.execute({
            tenantId: input.tenantId,
            channelId: input.channelId,
            marketplaceKey: input.marketplaceKey,
            normalizedOrder,
            ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
        });
        return { ingested: true, orderId: result.order.id, ingestionOutcome: result.outcome };
    }
    return { execute };
}
