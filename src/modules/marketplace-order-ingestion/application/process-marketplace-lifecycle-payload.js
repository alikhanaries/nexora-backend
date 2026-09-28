import { MarketplaceOrderLifecyclePermanentError } from './marketplace-order-lifecycle-errors.js';

/**
 * Normalizes a provider payload through the order adapter, then applies the lifecycle command.
 */
export class ProcessMarketplaceLifecyclePayload {
    deps;

    /**
     * @param {object} deps
     * @param {import('./marketplace-order-lifecycle-service.js').MarketplaceOrderLifecycleService} deps.lifecycleService
     * @param {import('../public/marketplace-order-adapter-registry.js').MarketplaceOrderAdapterRegistry} deps.orderAdapterRegistry
     * @param {import('../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} [deps.marketplaceAdapterRuntimeFactory]
     * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
     * @param {import('./ensure-marketplace-order-ingested-from-lifecycle.js').EnsureMarketplaceOrderIngestedFromLifecycle} [deps.ensureMarketplaceOrderIngestedFromLifecycle]
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
     * @param {string} [input.jobId]
     */
    async execute(input) {
        const adapter = this.deps.orderAdapterRegistry.resolve(input.marketplaceKey);
        if (adapter === null || typeof adapter.normalizeLifecycleCommand !== 'function') {
            throw new MarketplaceOrderLifecyclePermanentError('Marketplace adapter does not support lifecycle normalization', {
                marketplaceKey: input.marketplaceKey,
            });
        }
        const command = await this.deps.database.execute(async (tx) => {
            let runtime;
            if (this.deps.marketplaceAdapterRuntimeFactory !== undefined) {
                runtime = await this.deps.marketplaceAdapterRuntimeFactory.createForSync({
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
        if (this.deps.ensureMarketplaceOrderIngestedFromLifecycle !== undefined) {
            await this.deps.ensureMarketplaceOrderIngestedFromLifecycle.execute({
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
                payload: input.payload,
                command,
                ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
            });
        }
        return this.deps.lifecycleService.apply({
            tenantId: input.tenantId,
            channelId: input.channelId,
            command,
            ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
        });
    }
}
