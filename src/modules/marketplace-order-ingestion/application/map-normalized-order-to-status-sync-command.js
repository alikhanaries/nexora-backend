import { MarketplaceOrderLifecycleOperation } from '../domain/marketplace-order-lifecycle-operation.js';
import { NormalizedMarketplaceOrderStatus } from '../domain/normalized-marketplace-order-status.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../domain/normalized-marketplace-lifecycle-target-status.js';

/**
 * @param {object} input
 * @param {import('../public/normalized-marketplace-order.schema.js').NormalizedMarketplaceOrder} input.normalizedOrder
 * @param {string} input.externalEventId
 */
export function mapNormalizedMarketplaceOrderToStatusSyncCommand(input) {
    const { normalizedOrder } = input;
    return {
        operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
        marketplaceKey: normalizedOrder.marketplaceKey,
        externalOrderId: normalizedOrder.externalOrderId,
        externalEventId: input.externalEventId,
        targetStatus: mapOrderStatusToTarget(normalizedOrder.status),
    };
}

/**
 * @param {string} status
 */
function mapOrderStatusToTarget(status) {
    switch (status) {
        case NormalizedMarketplaceOrderStatus.PENDING:
        case NormalizedMarketplaceOrderStatus.CONFIRMED:
            return NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED;
        case NormalizedMarketplaceOrderStatus.CANCELLED:
            return NormalizedMarketplaceLifecycleTargetStatus.CANCELLED;
        case NormalizedMarketplaceOrderStatus.FULFILLED:
            return NormalizedMarketplaceLifecycleTargetStatus.FULFILLED;
        default:
            return NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN;
    }
}
