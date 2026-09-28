import { describe, expect, it, vi } from 'vitest';
import { MarketplaceTransientError, MarketplaceValidationError } from '../../../src/modules/marketplaces/domain/marketplace-errors.js';
import { mapMarketplaceFulfillmentToNoonCreateShipment } from '../../../src/modules/marketplaces/infrastructure/adapters/noon/map-marketplace-fulfillment-to-noon-create-shipment.js';
import { NoonOutboundOrderLifecycleAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/noon/noon-outbound-order-lifecycle-adapter.js';

const runtime = {
    marketplaceKey: 'noon',
    connectionRequired: true,
    credentials: { keyId: 'k', privateKey: 'pem', projectCode: 'proj' },
    configuration: { countryCode: 'ae', warehouseCode: 'WH-NOON-001' },
};

const context = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    channelId: '33333333-3333-4333-8333-333333333333',
    marketplaceKey: 'noon',
    externalOrderId: 'NFBO123456789',
    correlationId: null,
};

describe('mapMarketplaceFulfillmentToNoonCreateShipment', () => {
    it('maps fulfill request to CreateShipment body', () => {
        const mapped = mapMarketplaceFulfillmentToNoonCreateShipment(runtime, context.externalOrderId, {
            lines: [{ externalLineItemId: 'NFBO123456789-1', quantity: 1 }],
            trackingNumber: 'AWB123456789',
            carrier: 'noon',
        });
        expect(mapped.body.warehouse_code).toBe('WH-NOON-001');
        expect(mapped.body.fbpi_order_nr).toBe('NFBO123456789');
        expect(mapped.body.awbs).toEqual([{ courier: 'noon', awb_nr: 'AWB123456789' }]);
        expect(mapped.body.items).toEqual([{ mp_item_nr: 'NFBO123456789-1' }]);
        expect(mapped.body.integration_shipment_nr).toMatch(/^nexora-/);
    });

    it('rejects quantity other than 1 per line', () => {
        expect(() => mapMarketplaceFulfillmentToNoonCreateShipment(runtime, context.externalOrderId, {
            lines: [{ externalLineItemId: 'NFBO123456789-1', quantity: 2 }],
            trackingNumber: 'AWB1',
            carrier: 'noon',
        })).toThrow(MarketplaceValidationError);
    });
});

describe('NoonOutboundOrderLifecycleAdapter', () => {
    it('declares outbound fulfillment only', () => {
        const adapter = new NoonOutboundOrderLifecycleAdapter();
        expect(adapter.getLifecycleCapabilities().supportsOutboundFulfillment).toBe(true);
        expect(adapter.getLifecycleCapabilities().supportsOutboundCancellation).toBe(false);
    });

    it('calls createFbpiShipment with mapped payload', async () => {
        const createFbpiShipment = vi.fn(async () => ({ status: 200, json: {} }));
        const adapter = new NoonOutboundOrderLifecycleAdapter({
            api: { createFbpiShipment },
        });
        const result = await adapter.createFulfillment(runtime, context, {
            lines: [{ externalLineItemId: 'NFBO123456789-1', quantity: 1 }],
            trackingNumber: 'AWB999',
            carrier: 'DHL',
        });
        expect(result.outcome).toBe('fulfilled');
        expect(createFbpiShipment).toHaveBeenCalledOnce();
        const [callRuntime, body] = createFbpiShipment.mock.calls[0];
        expect(callRuntime).toBe(runtime);
        expect(body.fbpi_order_nr).toBe('NFBO123456789');
        expect(result.providerReference).toMatch(/^nexora-/);
    });

    it('maps transient errors to retryable adapter errors', async () => {
        const createFbpiShipment = vi.fn(async () => {
            throw new MarketplaceTransientError('timeout', { retryDelayMs: 5000 });
        });
        const adapter = new NoonOutboundOrderLifecycleAdapter({
            api: { createFbpiShipment },
        });
        await expect(adapter.createFulfillment(runtime, context, {
            lines: [{ externalLineItemId: 'NFBO123456789-1', quantity: 1 }],
            trackingNumber: 'AWB1',
            carrier: 'noon',
        })).rejects.toMatchObject({ name: 'MarketplaceCatalogAdapterRetryError' });
    });
});
