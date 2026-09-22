import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import {
    fingerprintReturnCommand,
    mapExternalReturnLinesToOrderLines,
    mapExternalReturnRequest,
    mapReturnResultToExternalResponse,
} from '../../../src/modules/compatibility/application/mappers/compatibility-return.mapper.js';

describe('compatibility return mapper', () => {
    it('maps MerchantOrderNo and reason fields', () => {
        expect(mapExternalReturnRequest({
            MerchantReturnNo: ' RET-1 ',
            MerchantOrderNo: ' ORD-1 ',
            Lines: [{ MerchantProductNo: 'SKU-A', Quantity: 2 }],
            MerchantComment: ' Defect ',
            Reason: 'PRODUCT_DEFECT',
        })).toEqual({
            orderNumber: 'ORD-1',
            merchantReturnNo: 'RET-1',
            externalLines: [{ MerchantProductNo: 'SKU-A', Quantity: 2 }],
            reason: 'Defect',
        });
    });

    it('maps merchant SKU to order line allocations', () => {
        const lines = mapExternalReturnLinesToOrderLines(
            [{ MerchantProductNo: 'SKU-A', Quantity: 2, OrderLineId: 42 }],
            [{
                id: 'line-1',
                merchantSku: 'SKU-A',
                quantity: 5,
                shippedQuantity: 4,
                returnedQuantity: 1,
            }],
        );
        expect(lines).toEqual([{ orderLineId: 'line-1', quantity: 2 }]);
    });

    it('throws when merchant product number is unknown', () => {
        expect(() => mapExternalReturnLinesToOrderLines(
            [{ MerchantProductNo: 'MISSING', Quantity: 1 }],
            [{
                id: 'line-1',
                merchantSku: 'SKU-A',
                quantity: 1,
                shippedQuantity: 1,
                returnedQuantity: 0,
            }],
        )).toThrow(NotFoundError);
    });

    it('builds external success response', () => {
        expect(mapReturnResultToExternalResponse({ return: { id: 'ret-1' } })).toEqual({
            Success: true,
            StatusCode: 201,
            Message: null,
        });
    });

    it('fingerprints mapped return command input', () => {
        const fingerprint = fingerprintReturnCommand({
            orderNumber: 'ORD-1',
            merchantReturnNo: 'RET-1',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            reason: 'Defect',
        });
        expect(fingerprint).toContain('ORD-1');
        expect(fingerprint).toContain('RET-1');
        expect(fingerprint).not.toContain('999001');
    });
});
