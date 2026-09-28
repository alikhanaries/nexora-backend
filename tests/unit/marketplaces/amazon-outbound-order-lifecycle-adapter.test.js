import { describe, expect, it, vi } from 'vitest';
import { MarketplaceCatalogAdapterPermanentError } from '../../../src/modules/channel-catalog-sync/public/catalog-sync-adapter-errors.js';
import { MarketplaceRateLimitError } from '../../../src/modules/marketplaces/domain/marketplace-errors.js';
import { AmazonOutboundOrderLifecycleAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-outbound-order-lifecycle-adapter.js';
import { mapMarketplaceFulfillmentToAmazonConfirmShipment } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/map-marketplace-fulfillment-to-amazon-confirm-shipment.js';

const runtime = {
    marketplaceKey: 'amazon',
    connectionRequired: true,
    credentials: {
        clientId: 'amzn1.application-oa2-client.test',
        clientSecret: 'secret',
        refreshToken: 'Atzr|refresh',
        awsAccessKeyId: 'AKIAEXAMPLE',
        awsSecretAccessKey: 'aws-secret',
        sellerId: 'SELLER123',
    },
    configuration: {
        marketplaceId: 'ATVPDKIKX0DER',
        region: 'na',
        shipFromSupplySourceId: 'supply-source-1',
    },
};

const context = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    channelId: '33333333-3333-4333-8333-333333333333',
    marketplaceKey: 'amazon',
    externalOrderId: '123-4567890-1234567',
    correlationId: null,
};

describe('mapMarketplaceFulfillmentToAmazonConfirmShipment', () => {
    it('maps lines, tracking, carrier, and marketplaceId', () => {
        const mapped = mapMarketplaceFulfillmentToAmazonConfirmShipment(runtime, {
            lines: [{ externalLineItemId: '60696125413094', quantity: 2 }],
            trackingNumber: '1Z999',
            carrier: 'UPS',
        }, '2025-06-01T12:00:00.000Z');
        expect(mapped.marketplaceId).toBe('ATVPDKIKX0DER');
        expect(mapped.packageDetail.carrierCode).toBe('UPS');
        expect(mapped.packageDetail.trackingNumber).toBe('1Z999');
        expect(mapped.packageDetail.shipDate).toBe('2025-06-01T12:00:00.000Z');
        expect(mapped.packageDetail.orderItems).toEqual([{ orderItemId: '60696125413094', quantity: 2 }]);
        expect(mapped.packageDetail.shipFromSupplySourceId).toBe('supply-source-1');
        expect(typeof mapped.packageReferenceId).toBe('string');
        expect(mapped.packageReferenceId.length).toBeGreaterThan(0);
    });
});

describe('AmazonOutboundOrderLifecycleAdapter', () => {
    it('declares outbound fulfillment only', () => {
        const adapter = new AmazonOutboundOrderLifecycleAdapter();
        expect(adapter.getLifecycleCapabilities()).toEqual({
            supportsOutboundCancellation: false,
            supportsOutboundRefund: false,
            supportsOutboundFulfillment: true,
            supportsOutboundReturns: false,
        });
    });

    it('calls confirmShipment with mapped body', async () => {
        const confirmShipment = vi.fn(async () => ({ status: 204, json: undefined }));
        const adapter = new AmazonOutboundOrderLifecycleAdapter({
            spApi: { confirmShipment },
        });
        const result = await adapter.createFulfillment(runtime, context, {
            lines: [{ externalLineItemId: '60696125413094', quantity: 1 }],
            trackingNumber: 'TRACK1',
            carrier: 'USPS',
        });
        expect(result.outcome).toBe('fulfilled');
        expect(confirmShipment).toHaveBeenCalledOnce();
        const [callRuntime, orderId, body] = confirmShipment.mock.calls[0];
        expect(callRuntime).toBe(runtime);
        expect(orderId).toBe(context.externalOrderId);
        expect(body.marketplaceId).toBe('ATVPDKIKX0DER');
        expect(body.packageDetail.orderItems[0].orderItemId).toBe('60696125413094');
    });

    it('maps rate limit errors to retryable adapter errors', async () => {
        const confirmShipment = vi.fn(async () => {
            throw new MarketplaceRateLimitError('Amazon throttled', { retryAfterSeconds: 10 });
        });
        const adapter = new AmazonOutboundOrderLifecycleAdapter({
            spApi: { confirmShipment },
        });
        await expect(adapter.createFulfillment(runtime, context, {
            lines: [{ externalLineItemId: 'line-1', quantity: 1 }],
            trackingNumber: 'T1',
            carrier: 'UPS',
        })).rejects.toMatchObject({ name: 'MarketplaceCatalogAdapterRetryError' });
    });

    it('maps validation errors to permanent adapter errors', async () => {
        const adapter = new AmazonOutboundOrderLifecycleAdapter({
            spApi: { confirmShipment: vi.fn() },
        });
        await expect(adapter.createFulfillment(runtime, context, {
            lines: [],
            trackingNumber: 'T1',
            carrier: 'UPS',
        })).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });
});
