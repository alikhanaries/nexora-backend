import { describe, expect, it } from 'vitest';
import { mapExternalStatusesToNexoraStatuses, mapOrderPageToExternalCollection, } from '../../../src/modules/compatibility/application/mappers/compatibility-order.mapper.js';

function buildOrder(overrides = {}) {
    const createdAt = new Date('2026-01-15T10:00:00.000Z');
    return {
        id: '11111111-1111-4111-8111-111111111111',
        tenantId: '22222222-2222-4222-8222-222222222222',
        channelId: '33333333-3333-4333-8333-333333333333',
        externalOrderReference: 'ext-123',
        orderNumber: 'ORD-00000001',
        status: 'NEW',
        currency: 'JPY',
        subtotalMinor: 1500,
        discountMinor: 0,
        taxMinor: 0,
        shippingMinor: 0,
        totalMinor: 1500,
        createdAt,
        updatedAt: createdAt,
        confirmedAt: null,
        cancelledAt: null,
        shippedAt: null,
        deliveredAt: null,
        lines: [{
            id: '44444444-4444-4444-8444-444444444444',
            tenantId: '22222222-2222-4222-8222-222222222222',
            orderId: '11111111-1111-4111-8111-111111111111',
            productId: '55555555-5555-4555-8555-555555555555',
            offerId: null,
            stockLocationId: '66666666-6666-4666-8666-666666666666',
            merchantSku: 'SKU-001',
            productTypeSnapshot: 'STANDARD',
            quantity: 3,
            cancelledQuantity: 0,
            shippedQuantity: 0,
            returnedQuantity: 0,
            unitPriceMinor: 500,
            discountMinor: 0,
            taxMinor: 0,
            lineTotalMinor: 1500,
            currency: 'JPY',
            status: 'CLOSED',
            createdAt,
            updatedAt: createdAt,
        }],
        customer: {
            id: '77777777-7777-4777-8777-777777777777',
            tenantId: '22222222-2222-4222-8222-222222222222',
            orderId: '11111111-1111-4111-8111-111111111111',
            externalCustomerReference: null,
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            phone: null,
            companyName: null,
            billingAddress: null,
            shippingAddress: null,
            metadata: {},
            createdAt,
        },
        ...overrides,
    };
}

describe('mapExternalStatusesToNexoraStatuses', () => {
    it('maps external IN_PROGRESS to multiple Nexora fulfillment statuses', () => {
        const statuses = mapExternalStatusesToNexoraStatuses(['IN_PROGRESS']);
        expect(statuses).toEqual(expect.arrayContaining(['CONFIRMED', 'PROCESSING', 'READY_TO_SHIP']));
        expect(statuses).toHaveLength(3);
    });
    it('maps external NEW without including CONFIRMED', () => {
        expect(mapExternalStatusesToNexoraStatuses(['NEW'])).toEqual(['NEW']);
    });
    it('maps external CANCELED to Nexora CANCELLED', () => {
        expect(mapExternalStatusesToNexoraStatuses(['CANCELED'])).toEqual(['CANCELLED']);
    });
    it('returns empty when only unmapped external statuses are requested', () => {
        expect(mapExternalStatusesToNexoraStatuses(['AWAITING_PAYMENT'])).toEqual([]);
    });
    it('combines mapped statuses from multiple external filters', () => {
        const statuses = mapExternalStatusesToNexoraStatuses(['NEW', 'SHIPPED']);
        expect(statuses).toEqual(expect.arrayContaining(['NEW', 'SHIPPED']));
        expect(statuses).toHaveLength(2);
    });
});

describe('compatibility order mapper', () => {
    it('maps JPY amounts without an incorrect /100 conversion', () => {
        const page = {
            items: [buildOrder()],
            totalCount: 1,
            page: 1,
            pageSize: 50,
        };
        const channelsById = new Map([['33333333-3333-4333-8333-333333333333', { name: 'Shop', externalReference: 'shop-1' }]]);
        const result = mapOrderPageToExternalCollection(page, channelsById);
        expect(result.Content[0].TotalInclVat).toBe(1500);
        expect(result.Content[0].Lines[0].LineTotalInclVat).toBe(1500);
        expect(result.Content[0].Lines[0].UnitPriceInclVat).toBe(500);
    });
    it('maps closed order lines to external CLOSED status', () => {
        const page = {
            items: [buildOrder()],
            totalCount: 1,
            page: 1,
            pageSize: 50,
        };
        const result = mapOrderPageToExternalCollection(page, new Map());
        expect(result.Content[0].Lines[0].Status).toBe('CLOSED');
    });
    it('does not expose internal UUIDs in the external order shape', () => {
        const page = {
            items: [buildOrder()],
            totalCount: 1,
            page: 1,
            pageSize: 50,
        };
        const result = mapOrderPageToExternalCollection(page, new Map());
        expect(result.Content[0].Id).toBeUndefined();
        expect(result.Content[0].tenantId).toBeUndefined();
        expect(result.Content[0].Lines[0].Id).toBeUndefined();
    });
    it('populates external order and line IDs when mappings are provided', () => {
        const page = {
            items: [buildOrder()],
            totalCount: 1,
            page: 1,
            pageSize: 50,
        };
        const externalIdMaps = {
            orderIds: new Map([['11111111-1111-4111-8111-111111111111', 42]]),
            orderLineIds: new Map([['44444444-4444-4444-8444-444444444444', 7]]),
        };
        const result = mapOrderPageToExternalCollection(page, new Map(), externalIdMaps);
        expect(result.Content[0].Id).toBe(42);
        expect(result.Content[0].Lines[0].Id).toBe(7);
    });
    it('omits external IDs when mappings are missing', () => {
        const page = {
            items: [buildOrder()],
            totalCount: 1,
            page: 1,
            pageSize: 50,
        };
        const externalIdMaps = {
            orderIds: new Map(),
            orderLineIds: new Map(),
        };
        const result = mapOrderPageToExternalCollection(page, new Map(), externalIdMaps);
        expect(result.Content[0].Id).toBeUndefined();
        expect(result.Content[0].Lines[0].Id).toBeUndefined();
    });
});
