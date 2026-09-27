import { MarketplaceOrderLifecycleOperation } from '../domain/marketplace-order-lifecycle-operation.js';
import { defaultMarketplaceOrderLifecycleCapabilities } from '../public/marketplace-order-lifecycle-capabilities.js';
import { MarketplaceOrderLifecycleUnsupportedError } from './marketplace-order-lifecycle-errors.js';

/**
 * @typedef {import('../public/marketplace-order-adapter.port.js').MarketplaceOrderLifecycleCapabilities} MarketplaceOrderLifecycleCapabilities
 */
export { defaultMarketplaceOrderLifecycleCapabilities };

/** @type {Record<string, keyof MarketplaceOrderLifecycleCapabilities>} */
const OPERATION_CAPABILITY = Object.freeze({
    [MarketplaceOrderLifecycleOperation.UPDATE_ORDER]: 'supportsOrderUpdate',
    [MarketplaceOrderLifecycleOperation.CANCEL_ORDER]: 'supportsOrderCancel',
    [MarketplaceOrderLifecycleOperation.RETURN_ORDER]: 'supportsOrderReturn',
    [MarketplaceOrderLifecycleOperation.REFUND_ORDER]: 'supportsOrderRefund',
    [MarketplaceOrderLifecycleOperation.FULFILL_ORDER]: 'supportsOrderFulfill',
    [MarketplaceOrderLifecycleOperation.SHIPMENT_UPDATE]: 'supportsShipmentUpdate',
    [MarketplaceOrderLifecycleOperation.STATUS_SYNC]: 'supportsOrderStatusSync',
});

/**
 * @param {string} operation
 * @param {MarketplaceOrderLifecycleCapabilities | undefined} capabilities
 * @param {string} marketplaceKey
 */
export function assertMarketplaceOrderLifecycleCapability(operation, capabilities, marketplaceKey) {
    const capKey = OPERATION_CAPABILITY[operation];
    if (capKey === undefined) {
        throw new MarketplaceOrderLifecycleUnsupportedError(operation, marketplaceKey);
    }
    const caps = capabilities ?? defaultMarketplaceOrderLifecycleCapabilities();
    if (caps[capKey] !== true) {
        throw new MarketplaceOrderLifecycleUnsupportedError(operation, marketplaceKey);
    }
}
