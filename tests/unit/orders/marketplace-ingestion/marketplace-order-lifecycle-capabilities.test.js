import { describe, expect, it } from 'vitest';
import { MarketplaceOrderLifecycleOperation } from '../../../../src/modules/orders/marketplace-ingestion/models/marketplace-order-lifecycle-operation.js';
import { assertMarketplaceOrderLifecycleCapability } from '../../../../src/modules/orders/marketplace-ingestion/services/marketplace-order-lifecycle-capabilities.js';
import { MarketplaceOrderLifecycleUnsupportedError } from '../../../../src/modules/orders/marketplace-ingestion/public/marketplace-order-lifecycle-errors.js';

describe('marketplace order lifecycle capabilities', () => {
    it('throws unsupported when capability is false', () => {
        expect(() => assertMarketplaceOrderLifecycleCapability(
            MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            { supportsOrderCancel: false, supportsOrderUpdate: false, supportsOrderReturn: false, supportsOrderRefund: false, supportsOrderFulfill: false, supportsShipmentUpdate: false, supportsOrderStatusSync: false },
            'shopify',
        )).toThrow(MarketplaceOrderLifecycleUnsupportedError);
    });

    it('allows operation when capability is true', () => {
        expect(() => assertMarketplaceOrderLifecycleCapability(
            MarketplaceOrderLifecycleOperation.STATUS_SYNC,
            { supportsOrderCancel: false, supportsOrderUpdate: false, supportsOrderReturn: false, supportsOrderRefund: false, supportsOrderFulfill: false, supportsShipmentUpdate: false, supportsOrderStatusSync: true },
            'test-mp',
        )).not.toThrow();
    });
});
