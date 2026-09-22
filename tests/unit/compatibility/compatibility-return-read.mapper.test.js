import { describe, expect, it } from 'vitest';
import {
    mapEmptyReturnPageToExternalCollection,
    mapExternalReturn,
    mapExternalReturnStatusesToNexoraStatuses,
    mapNewReturnStatusFilter,
    mapReturnPageToExternalCollection,
} from '../../../src/modules/compatibility/application/mappers/compatibility-return.mapper.js';

const createdAt = new Date('2026-01-15T10:00:00.000Z');
const updatedAt = new Date('2026-01-16T10:00:00.000Z');

function buildReturn(overrides = {}) {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        tenantId: '22222222-2222-4222-8222-222222222222',
        orderId: '33333333-3333-4333-8333-333333333333',
        externalReference: 'RET-001',
        status: 'REQUESTED',
        reason: 'PRODUCT_DEFECT',
        createdAt,
        updatedAt,
        lines: [{
            id: '44444444-4444-4444-8444-444444444444',
            orderLineId: '55555555-5555-4555-8555-555555555555',
            quantity: 1,
        }],
        ...overrides,
    };
}

describe('compatibility return read mapper', () => {
    it('maps REQUESTED to external IN_PROGRESS', () => {
        const order = {
            orderNumber: 'ORD-001',
            externalOrderReference: 'channel-001',
            channelId: '66666666-6666-4666-8666-666666666666',
            lines: [{ id: '55555555-5555-4555-8555-555555555555', merchantSku: 'SKU-001' }],
        };
        const ordersById = new Map([[order.orderNumber, order]]);
        ordersById.set(buildReturn().orderId, order);
        const channelsById = new Map([[order.channelId, { name: 'Test Channel' }]]);
        const mapped = mapReturnPageToExternalCollection({
            items: [buildReturn()],
            totalCount: 1,
            page: 1,
            pageSize: 50,
        }, ordersById, channelsById);
        expect(mapped.Content[0]).toMatchObject({
            MerchantReturnNo: 'RET-001',
            MerchantOrderNo: 'ORD-001',
            Status: 'IN_PROGRESS',
            Reason: 'PRODUCT_DEFECT',
            ChannelName: 'Test Channel',
        });
    });

    it('maps new return filter to pending Nexora statuses', () => {
        expect(mapNewReturnStatusFilter()).toEqual(['IN_PROGRESS']);
        expect(mapExternalReturnStatusesToNexoraStatuses(['IN_PROGRESS'])).toEqual([
            'REQUESTED',
            'APPROVED',
            'RECEIVED',
        ]);
    });

    it('populates external return ID when mapping is provided', () => {
        const order = {
            orderNumber: 'ORD-001',
            externalOrderReference: 'channel-001',
            channelId: '66666666-6666-4666-8666-666666666666',
            lines: [{ id: '55555555-5555-4555-8555-555555555555', merchantSku: 'SKU-001' }],
        };
        const orderLinesById = new Map(order.lines.map((line) => [line.id, line]));
        const mapped = mapExternalReturn(
            buildReturn(),
            order,
            orderLinesById,
            { name: 'Test Channel' },
            { returnIds: new Map([['11111111-1111-4111-8111-111111111111', 88]]) },
        );
        expect(mapped.Id).toBe(88);
    });

    it('omits external return ID when mapping is missing', () => {
        const order = {
            orderNumber: 'ORD-001',
            externalOrderReference: 'channel-001',
            channelId: '66666666-6666-4666-8666-666666666666',
            lines: [{ id: '55555555-5555-4555-8555-555555555555', merchantSku: 'SKU-001' }],
        };
        const orderLinesById = new Map(order.lines.map((line) => [line.id, line]));
        const mapped = mapExternalReturn(
            buildReturn(),
            order,
            orderLinesById,
            { name: 'Test Channel' },
            { returnIds: new Map() },
        );
        expect(mapped.Id).toBeUndefined();
    });

    it('returns empty page for unmapped external statuses', () => {
        expect(mapExternalReturnStatusesToNexoraStatuses(['AUTO_CLOSED'])).toEqual([]);
        expect(mapEmptyReturnPageToExternalCollection(50)).toMatchObject({
            Content: [],
            TotalCount: 0,
            ItemsPerPage: 50,
        });
    });
});
