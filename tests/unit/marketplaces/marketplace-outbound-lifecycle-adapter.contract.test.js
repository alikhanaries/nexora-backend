import { describe, expect, it } from 'vitest';
import { registerMarketplaceOutboundOrderLifecycleAdapters } from '../../../src/modules/marketplaces/infrastructure/adapters/register-marketplace-outbound-order-lifecycle-adapters.js';
import { MarketplaceOutboundOrderLifecycleAdapterRegistry } from '../../../src/modules/marketplaces/application/marketplace-outbound-order-lifecycle-adapter-registry.js';

const OUTBOUND_CAPABILITY_KEYS = [
    'supportsOutboundCancellation',
    'supportsOutboundRefund',
    'supportsOutboundFulfillment',
    'supportsOutboundReturns',
];

const METHOD_BY_CAPABILITY = {
    supportsOutboundCancellation: 'cancelOrder',
    supportsOutboundRefund: 'refundOrder',
    supportsOutboundFulfillment: 'createFulfillment',
};

/**
 * @param {import('../../../src/modules/marketplaces/public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOutboundOrderLifecycleAdapter} adapter
 */
function assertOutboundAdapterContract(adapter) {
    expect(typeof adapter.marketplaceKey).toBe('string');
    expect(adapter.marketplaceKey.length).toBeGreaterThan(0);
    const caps = adapter.getLifecycleCapabilities();
    for (const key of OUTBOUND_CAPABILITY_KEYS) {
        expect(typeof caps[key]).toBe('boolean');
    }
    for (const [capKey, methodName] of Object.entries(METHOD_BY_CAPABILITY)) {
        if (caps[capKey] === true) {
            expect(typeof adapter[methodName]).toBe('function');
        }
    }
}

describe('MarketplaceOutboundOrderLifecycleAdapter contract', () => {
    it('registered adapters satisfy the outbound contract', () => {
        const registry = new MarketplaceOutboundOrderLifecycleAdapterRegistry();
        registerMarketplaceOutboundOrderLifecycleAdapters(registry);
        for (const adapter of registry.adapters.values()) {
            assertOutboundAdapterContract(adapter);
        }
    });
});
