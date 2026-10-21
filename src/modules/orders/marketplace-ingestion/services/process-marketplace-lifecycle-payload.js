import { MarketplaceOrderLifecyclePermanentError } from './marketplace-order-lifecycle-errors.js';

/**
 * Normalizes a provider payload through the order adapter, then applies the lifecycle command.
 */
/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createProcessMarketplaceLifecyclePayload(deps) {
    /**
     * @param {object} input
     * @param {string} input.tenantId
     * @param {string} input.channelId
     * @param {string} input.marketplaceKey
     * @param {unknown} input.payload
     * @param {string} [input.jobId]
     */
    async function execute(input) {
        const adapter = deps.orderAdapterRegistry.resolve(input.marketplaceKey);
        if (adapter === null || typeof adapter.normalizeLifecycleCommand !== 'function') {
            throw new MarketplaceOrderLifecyclePermanentError('Marketplace adapter does not support lifecycle normalization', {
                marketplaceKey: input.marketplaceKey,
            });
        }
        const command = await deps.database.execute(async (tx) => {
            let runtime;
            if (deps.marketplaceAdapterRuntimeFactory !== undefined) {
                runtime = await deps.marketplaceAdapterRuntimeFactory.createForSync({
                    tenantId: input.tenantId,
                    channelId: input.channelId,
                    marketplaceKey: input.marketplaceKey,
                    tx,
                });
            }
            return adapter.normalizeLifecycleCommand(input.payload, runtime, {
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
            });
        }, { tenantId: input.tenantId });
        if (deps.ensureMarketplaceOrderIngestedFromLifecycle !== undefined) {
            await deps.ensureMarketplaceOrderIngestedFromLifecycle.execute({
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
                payload: input.payload,
                command,
                ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
            });
        }
        return deps.lifecycleService.apply({
            tenantId: input.tenantId,
            channelId: input.channelId,
            command,
            ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
        });
    }
    return { execute };
}
