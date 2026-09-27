import { describe, expect, it } from 'vitest';
import { MarketplaceOutboundOrderLifecycleAdapterRegistry } from '../../../src/modules/marketplaces/application/marketplace-outbound-order-lifecycle-adapter-registry.js';
import { registerMarketplaceOutboundOrderLifecycleAdapters } from '../../../src/modules/marketplaces/infrastructure/adapters/register-marketplace-outbound-order-lifecycle-adapters.js';
import { MARKETPLACE_OUTBOUND_ORDER_LIFECYCLE_PROVIDER_KEYS } from '../../../src/modules/marketplaces/public/marketplace-outbound-order-lifecycle-providers.js';

describe('marketplace outbound order lifecycle registration', () => {
    it('registers every declared outbound provider key', () => {
        const registry = new MarketplaceOutboundOrderLifecycleAdapterRegistry();
        registerMarketplaceOutboundOrderLifecycleAdapters(registry);
        for (const key of MARKETPLACE_OUTBOUND_ORDER_LIFECYCLE_PROVIDER_KEYS) {
            const adapter = registry.resolve(key);
            expect(adapter, `missing outbound adapter for ${key}`).not.toBeNull();
            expect(adapter?.marketplaceKey).toBe(key);
            expect(typeof adapter?.getLifecycleCapabilities).toBe('function');
        }
    });
});
