import { describe, expect, it } from 'vitest';
import { normalizedMarketplaceLifecycleCommandSchema } from '../../../src/modules/marketplace-order-ingestion/application/normalized-marketplace-lifecycle-command.schema.js';
import { MarketplaceOrderLifecycleOperation } from '../../../src/modules/marketplace-order-ingestion/domain/marketplace-order-lifecycle-operation.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-lifecycle-target-status.js';

describe('normalized marketplace lifecycle command schema', () => {
    it('parses status_sync command', () => {
        const parsed = normalizedMarketplaceLifecycleCommandSchema.parse({
            operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
            marketplaceKey: 'shopify',
            externalOrderId: '1001',
            externalEventId: 'evt-1',
            targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
        });
        expect(parsed.operation).toBe('status_sync');
    });

    it('rejects missing externalEventId', () => {
        expect(() => normalizedMarketplaceLifecycleCommandSchema.parse({
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            marketplaceKey: 'shopify',
            externalOrderId: '1001',
        })).toThrow();
    });
});
