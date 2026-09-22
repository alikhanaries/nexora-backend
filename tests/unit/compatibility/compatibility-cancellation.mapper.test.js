import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import {
    fingerprintCancellationCommand,
    mapExternalCancellationLinesToOrderLines,
    mapExternalCancellationRequest,
    mapCancellationResultToExternalResponse,
} from '../../../src/modules/compatibility/application/mappers/compatibility-cancellation.mapper.js';

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
