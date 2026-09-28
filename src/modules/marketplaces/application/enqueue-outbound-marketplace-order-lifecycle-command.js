/**
 * Enqueues outbound marketplace lifecycle work for asynchronous worker execution.
 */
export class EnqueueOutboundMarketplaceOrderLifecycleCommand {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../marketplace-order-ingestion/application/marketplace-lifecycle-enqueue-service.js').MarketplaceLifecycleEnqueueService} deps.lifecycleEnqueueService
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
        return this.deps.lifecycleEnqueueService.enqueueOutboundCommand(input);
    }
}
