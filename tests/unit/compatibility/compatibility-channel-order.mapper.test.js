import { describe, expect, it } from 'vitest';
import {
    fingerprintChannelFulfilledOrderCommand,
    fingerprintChannelOrderCommand,
    mapExternalChannelFulfilledOrderRequest,
    mapExternalChannelOrderRequest,
    resolveChannelStockLocationId,
} from '../../../src/modules/compatibility/application/mappers/compatibility-channel-order.mapper.js';
import { BusinessRuleError } from '../../../src/shared/errors/index.js';

describe('compatibility-channel-order.mapper', () => {
    const channelId = '33333333-3333-4333-8333-333333333333';
    const stockLocationId = '66666666-6666-4666-8666-666666666666';

    it('maps a verified Channel create request to createChannelOrder input', () => {
        const mapped = mapExternalChannelOrderRequest({
            ChannelOrderNo: 'CH-1001',
            CurrencyCode: 'USD',
            Email: 'buyer@example.com',
            OrderDate: '2026-01-15T10:00:00.000Z',
            ShippingCostsInclVat: 5.5,
            BillingAddress: {
                FirstName: 'Ada',
                LastName: 'Lovelace',
                Line1: '1 Analytical Engine Way',
                City: 'London',
                ZipCode: 'SW1A 1AA',
                CountryIso: 'GB',
            },
            ShippingAddress: {
                FirstName: 'Ada',
                LastName: 'Lovelace',
                Line1: '1 Analytical Engine Way',
                City: 'London',
                ZipCode: 'SW1A 1AA',
                CountryIso: 'GB',
            },
            Lines: [{
                MerchantProductNo: 'SKU-001',
                ChannelProductNo: 'CH-SKU-001',
                Quantity: 2,
                UnitPriceInclVat: 12.5,
            }],
        }, { channelId, stockLocationId });

        expect(mapped).toEqual({
            channelId,
            externalOrderReference: 'CH-1001',
            currency: 'USD',
            shippingMinor: 550,
            lines: [{
                stockLocationId,
                quantity: 2,
                merchantSku: 'SKU-001',
                channelProductNo: 'CH-SKU-001',
            }],
            customer: {
                firstName: 'Ada',
                lastName: 'Lovelace',
                email: 'buyer@example.com',
                phone: null,
                companyName: null,
                billingAddress: {
                    line1: '1 Analytical Engine Way',
                    line2: null,
                    city: 'London',
                    region: null,
                    postalCode: 'SW1A 1AA',
                    countryCode: 'GB',
                },
                shippingAddress: {
                    line1: '1 Analytical Engine Way',
                    line2: null,
                    city: 'London',
                    region: null,
                    postalCode: 'SW1A 1AA',
                    countryCode: 'GB',
                },
            },
        });
    });

    it('fingerprints mapped core input for idempotency', () => {
        const mapped = mapExternalChannelOrderRequest({
            ChannelOrderNo: 'CH-1001',
            CurrencyCode: 'USD',
            Email: 'buyer@example.com',
            OrderDate: '2026-01-15T10:00:00.000Z',
            ShippingCostsInclVat: 0,
            BillingAddress: { Line1: 'Line 1' },
            ShippingAddress: { Line1: 'Line 1' },
            Lines: [{
                MerchantProductNo: 'SKU-001',
                Quantity: 1,
                UnitPriceInclVat: 10,
            }],
        }, { channelId, stockLocationId });

        expect(fingerprintChannelOrderCommand(mapped)).toBe(JSON.stringify({
            channelId,
            externalOrderReference: 'CH-1001',
            currency: 'USD',
            shippingMinor: 0,
            lines: [{
                stockLocationId,
                quantity: 1,
                merchantSku: 'SKU-001',
            }],
            customer: mapped.customer,
        }));
    });

    it('maps a verified Channel channel-fulfilled request with derived shipment metadata', () => {
        const mapped = mapExternalChannelFulfilledOrderRequest({
            ChannelOrderNo: 'CH-FUL-1001',
            CurrencyCode: 'USD',
            Email: 'buyer@example.com',
            OrderDate: '2026-01-15T10:00:00.000Z',
            ShippingCostsInclVat: 0,
            ShippingMethod: 'DHL',
            ShippingServiceLevel: 'Express',
            BillingAddress: { Line1: 'Line 1' },
            ShippingAddress: { Line1: 'Line 1' },
            Lines: [{
                MerchantProductNo: 'SKU-001',
                Quantity: 1,
                UnitPriceInclVat: 10,
            }],
        }, { channelId, stockLocationId });

        expect(mapped.externalOrderReference).toBe('CH-FUL-1001');
        expect(mapped.shipment).toEqual({
            externalReference: 'CH-FUL-1001-fulfillment',
            carrier: 'DHL',
            service: 'Express',
            trackingNumber: null,
        });
    });

    it('fingerprints channel-fulfilled mapped input including shipment metadata', () => {
        const mapped = mapExternalChannelFulfilledOrderRequest({
            ChannelOrderNo: 'CH-FUL-1001',
            CurrencyCode: 'USD',
            Email: 'buyer@example.com',
            OrderDate: '2026-01-15T10:00:00.000Z',
            ShippingCostsInclVat: 0,
            ShippingMethod: 'DHL',
            BillingAddress: { Line1: 'Line 1' },
            ShippingAddress: { Line1: 'Line 1' },
            Lines: [{
                MerchantProductNo: 'SKU-001',
                Quantity: 1,
                UnitPriceInclVat: 10,
            }],
        }, { channelId, stockLocationId });

        expect(fingerprintChannelFulfilledOrderCommand(mapped)).toBe(JSON.stringify({
            channelId,
            externalOrderReference: 'CH-FUL-1001',
            currency: 'USD',
            shippingMinor: 0,
            lines: [{
                stockLocationId,
                quantity: 1,
                merchantSku: 'SKU-001',
            }],
            customer: mapped.customer,
            shipment: mapped.shipment,
        }));
    });

    it('requires channel configurationReference to contain a stock location UUID', () => {
        expect(() => resolveChannelStockLocationId({
            id: channelId,
            configurationReference: null,
        })).toThrow(BusinessRuleError);

        expect(() => resolveChannelStockLocationId({
            id: channelId,
            configurationReference: 'warehouse-main',
        })).toThrow(BusinessRuleError);

        expect(resolveChannelStockLocationId({
            id: channelId,
            configurationReference: stockLocationId,
        })).toBe(stockLocationId);
    });
});
