import { describe, expect, it } from 'vitest';
import {
    mapExternalShipment,
    mapEmptyShipmentPageToExternalCollection,
    mapShipmentPageToExternalCollection,
} from '../../../src/modules/compatibility/application/mappers/compatibility-shipment.mapper.js';

const createdAt = new Date('2026-01-15T10:00:00.000Z');
const updatedAt = new Date('2026-01-16T10:00:00.000Z');

function buildShipment(overrides = {}) {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        tenantId: '22222222-2222-4222-8222-222222222222',
        orderId: '33333333-3333-4333-8333-333333333333',
        externalReference: 'SHIP-001',
        carrier: 'DHL',
        service: null,
        trackingNumber: 'TRACK-1',
        status: 'SHIPPED',
        shippedAt: createdAt,
        deliveredAt: null,
        createdAt,
        updatedAt,
        lines: [{
            id: '44444444-4444-4444-8444-444444444444',
            orderLineId: '55555555-5555-4555-8555-555555555555',
            quantity: 2,
        }],
        ...overrides,
    };
}

describe('compatibility shipment read mapper', () => {
    it('maps shipment detail with external references and lines', () => {
        const order = {
            orderNumber: 'ORD-001',
            externalOrderReference: 'channel-001',
            lines: [{ id: '55555555-5555-4555-8555-555555555555', merchantSku: 'SKU-001' }],
        };
        const orderLinesById = new Map(order.lines.map((line) => [line.id, line]));
        const mapped = mapExternalShipment(buildShipment(), order, orderLinesById);
        expect(mapped).toMatchObject({
            MerchantShipmentNo: 'SHIP-001',
            MerchantOrderNo: 'ORD-001',
            ChannelOrderNo: 'channel-001',
            Method: 'DHL',
            TrackTraceNo: 'TRACK-1',
            Lines: [{ MerchantProductNo: 'SKU-001', Quantity: 2 }],
        });
        expect(mapped.Id).toBeUndefined();
    });

    it('populates external shipment ID when mapping is provided', () => {
        const order = {
            orderNumber: 'ORD-001',
            externalOrderReference: 'channel-001',
            lines: [{ id: '55555555-5555-4555-8555-555555555555', merchantSku: 'SKU-001' }],
        };
        const orderLinesById = new Map(order.lines.map((line) => [line.id, line]));
        const mapped = mapExternalShipment(buildShipment(), order, orderLinesById, {
            shipmentIds: new Map([['11111111-1111-4111-8111-111111111111', 99]]),
        });
        expect(mapped.Id).toBe(99);
    });

    it('omits external shipment ID when mapping is missing', () => {
        const order = {
            orderNumber: 'ORD-001',
            externalOrderReference: 'channel-001',
            lines: [{ id: '55555555-5555-4555-8555-555555555555', merchantSku: 'SKU-001' }],
        };
        const orderLinesById = new Map(order.lines.map((line) => [line.id, line]));
        const mapped = mapExternalShipment(buildShipment(), order, orderLinesById, {
            shipmentIds: new Map(),
        });
        expect(mapped.Id).toBeUndefined();
    });

    it('maps pagination metadata from core page results', () => {
        const order = {
            orderNumber: 'ORD-001',
            externalOrderReference: 'channel-001',
            lines: [{ id: '55555555-5555-4555-8555-555555555555', merchantSku: 'SKU-001' }],
        };
        const ordersById = new Map([[buildShipment().orderId, order]]);
        const mapped = mapShipmentPageToExternalCollection({
            items: [buildShipment()],
            totalCount: 10,
            page: 2,
            pageSize: 5,
        }, ordersById);
        expect(mapped).toMatchObject({
            Success: true,
            StatusCode: 200,
            Count: 1,
            TotalCount: 10,
            ItemsPerPage: 5,
        });
    });

    it('returns empty collection metadata', () => {
        expect(mapEmptyShipmentPageToExternalCollection(2, 25)).toMatchObject({
            Content: [],
            Count: 0,
            TotalCount: 0,
            ItemsPerPage: 25,
        });
    });
});
