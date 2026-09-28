import { describe, expect, it, vi } from 'vitest';
import { MarketplaceTransientError, MarketplaceValidationError } from '../../../src/modules/marketplaces/domain/marketplace-errors.js';
import { mapMarketplaceFulfillmentToNamshiCreateShipment } from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/map-marketplace-fulfillment-to-namshi-create-shipment.js';
import { NamshiOutboundOrderLifecycleAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/namshi-outbound-order-lifecycle-adapter.js';

const runtime = {
    marketplaceKey: 'namshi',
    connectionRequired: true,
    credentials: { keyId: 'k', privateKey: 'pem', projectCode: 'proj' },
    configuration: { countryCode: 'ae', warehouseCode: 'WH-NAMSHI-001' },
};

const context = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    channelId: '33333333-3333-4333-8333-333333333333',
    marketplaceKey: 'namshi',
    externalOrderId: 'NFBO987654321',
    correlationId: null,
};

describe('mapMarketplaceFulfillmentToNamshiCreateShipment', () => {
    it('maps fulfill request to CreateShipment body', () => {
        const mapped = mapMarketplaceFulfillmentToNamshiCreateShipment(runtime, context.externalOrderId, {
            lines: [{ externalLineItemId: 'NFBO987654321-1', quantity: 1 }],
            trackingNumber: 'AWB-NAM-1',
            carrier: 'noon',
        });
        expect(mapped.body.warehouse_code).toBe('WH-NAMSHI-001');
        expect(mapped.body.fbpi_order_nr).toBe('NFBO987654321');
        expect(mapped.body.items).toEqual([{ mp_item_nr: 'NFBO987654321-1' }]);
        expect(mapped.integrationShipmentNr).toMatch(/^namshi-/);
    });

    it('rejects quantity other than 1', () => {
        expect(() => mapMarketplaceFulfillmentToNamshiCreateShipment(runtime, context.externalOrderId, {
            lines: [{ externalLineItemId: 'NFBO987654321-1', quantity: 2 }],
            trackingNumber: 'AWB1',
            carrier: 'noon',
        })).toThrow(MarketplaceValidationError);
    });
});

describe('NamshiOutboundOrderLifecycleAdapter', () => {
    it('declares outbound fulfillment only', () => {
        const adapter = new NamshiOutboundOrderLifecycleAdapter();
        expect(adapter.getLifecycleCapabilities()).toEqual({
            supportsOutboundCancellation: false,
            supportsOutboundRefund: false,
            supportsOutboundFulfillment: true,
            supportsOutboundReturns: false,
        });
    });

    it('calls createFbpiShipment with mapped payload', async () => {
        const createFbpiShipment = vi.fn(async () => ({ status: 200, json: {} }));
        const adapter = new NamshiOutboundOrderLifecycleAdapter({
            api: { createFbpiShipment },
        });
        const result = await adapter.createFulfillment(runtime, context, {
            lines: [{ externalLineItemId: 'NFBO987654321-1', quantity: 1 }],
            trackingNumber: 'AWB999',
            carrier: 'DHL',
        });
        expect(result.outcome).toBe('fulfilled');
        expect(createFbpiShipment).toHaveBeenCalledOnce();
        expect(createFbpiShipment.mock.calls[0][1].fbpi_order_nr).toBe('NFBO987654321');
    });

    it('maps transient errors to retryable adapter errors', async () => {
        const createFbpiShipment = vi.fn(async () => {
            throw new MarketplaceTransientError('timeout', { retryDelayMs: 5000 });
        });
        const adapter = new NamshiOutboundOrderLifecycleAdapter({
            api: { createFbpiShipment },
        });
        await expect(adapter.createFulfillment(runtime, context, {
            lines: [{ externalLineItemId: 'NFBO987654321-1', quantity: 1 }],
            trackingNumber: 'AWB1',
            carrier: 'noon',
        })).rejects.toMatchObject({ name: 'MarketplaceCatalogAdapterRetryError' });
    });
});
