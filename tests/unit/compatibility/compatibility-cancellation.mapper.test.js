import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import {
    fingerprintCancellationCommand,
    mapExternalCancellation,
    mapExternalCancellationLinesToOrderLines,
    mapExternalCancellationRequest,
    mapCancellationResultToExternalResponse,
} from '../../../src/modules/compatibility/application/mappers/compatibility-cancellation.mapper.js';

const createdAt = new Date('2026-01-15T10:00:00.000Z');

function buildCancellation(overrides = {}) {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        externalReference: 'CAN-001',
        orderId: '22222222-2222-4222-8222-222222222222',
        reason: 'Out of stock',
        createdAt,
        lines: [{
            orderLineId: '33333333-3333-4333-8333-333333333333',
            quantity: 1,
        }],
        ...overrides,
    };
}

describe('compatibility cancellation mapper', () => {
    it('maps MerchantOrderNo and reason fields', () => {
        expect(mapExternalCancellationRequest({
            MerchantCancellationNo: ' CAN-1 ',
            MerchantOrderNo: ' ORD-1 ',
            Lines: [{ MerchantProductNo: 'SKU-A', Quantity: 2 }],
            Reason: ' Out of stock ',
        })).toEqual({
            orderNumber: 'ORD-1',
            merchantCancellationNo: 'CAN-1',
            externalLines: [{ MerchantProductNo: 'SKU-A', Quantity: 2 }],
            reason: 'Out of stock',
        });
    });

    it('maps merchant SKU to order line allocations', () => {
        const lines = mapExternalCancellationLinesToOrderLines(
            [{ MerchantProductNo: 'SKU-A', Quantity: 3, OrderLineId: 42 }],
            [{
                id: 'line-1',
                merchantSku: 'SKU-A',
                quantity: 5,
                cancelledQuantity: 0,
                shippedQuantity: 1,
            }],
        );
        expect(lines).toEqual([{ orderLineId: 'line-1', quantity: 3 }]);
    });

    it('allocates across duplicate SKUs on multiple order lines', () => {
        const lines = mapExternalCancellationLinesToOrderLines(
            [{ MerchantProductNo: 'SKU-A', Quantity: 5 }],
            [
                {
                    id: 'line-1',
                    merchantSku: 'SKU-A',
                    quantity: 3,
                    cancelledQuantity: 0,
                    shippedQuantity: 0,
                },
                {
                    id: 'line-2',
                    merchantSku: 'SKU-A',
                    quantity: 4,
                    cancelledQuantity: 0,
                    shippedQuantity: 0,
                },
            ],
        );
        expect(lines).toEqual([
            { orderLineId: 'line-1', quantity: 3 },
            { orderLineId: 'line-2', quantity: 2 },
        ]);
    });

    it('throws when merchant product number is unknown', () => {
        expect(() => mapExternalCancellationLinesToOrderLines(
            [{ MerchantProductNo: 'MISSING', Quantity: 1 }],
            [{
                id: 'line-1',
                merchantSku: 'SKU-A',
                quantity: 1,
                cancelledQuantity: 0,
                shippedQuantity: 0,
            }],
        )).toThrow(NotFoundError);
    });

    it('builds external success response', () => {
        expect(mapCancellationResultToExternalResponse({ cancellation: { id: 'can-1' } })).toEqual({
            Success: true,
            StatusCode: 201,
            Message: null,
        });
    });

    it('populates external cancellation ID when mapping is provided', () => {
        const order = {
            orderNumber: 'ORD-001',
            externalOrderReference: 'channel-001',
            lines: [{ id: '33333333-3333-4333-8333-333333333333', merchantSku: 'SKU-001' }],
        };
        const orderLinesById = new Map(order.lines.map((line) => [line.id, line]));
        const mapped = mapExternalCancellation(buildCancellation(), order, orderLinesById, {
            cancellationIds: new Map([['11111111-1111-4111-8111-111111111111', 15]]),
        });
        expect(mapped.Id).toBe(15);
    });

    it('omits external cancellation ID when mapping is missing', () => {
        const order = {
            orderNumber: 'ORD-001',
            externalOrderReference: 'channel-001',
            lines: [{ id: '33333333-3333-4333-8333-333333333333', merchantSku: 'SKU-001' }],
        };
        const orderLinesById = new Map(order.lines.map((line) => [line.id, line]));
        const mapped = mapExternalCancellation(buildCancellation(), order, orderLinesById, {
            cancellationIds: new Map(),
        });
        expect(mapped.Id).toBeUndefined();
    });

    it('fingerprints mapped cancellation command input', () => {
        const fingerprint = fingerprintCancellationCommand({
            orderNumber: 'ORD-1',
            merchantCancellationNo: 'CAN-1',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            reason: 'Customer request',
        });
        expect(fingerprint).toContain('ORD-1');
        expect(fingerprint).toContain('CAN-1');
        expect(fingerprint).not.toContain('999001');
    });
});
