import { describe, expect, it } from 'vitest';
import { isEquivalentReturnRequest } from '../../../src/modules/returns/application/return-request-equivalence.js';

describe('return request equivalence', () => {
    const existingReturn = {
        orderId: 'order-1',
        shipmentId: null,
        reason: 'Defect',
    };

    it('returns true for equivalent line quantities and reason', () => {
        const requestedByLine = new Map([['line-1', 2]]);
        expect(isEquivalentReturnRequest(
            existingReturn,
            [{ orderLineId: 'line-1', quantity: 2, reason: null }],
            { orderId: 'order-1' },
            requestedByLine,
            'Defect',
            null,
        )).toBe(true);
    });

    it('returns false when quantities differ', () => {
        const requestedByLine = new Map([['line-1', 3]]);
        expect(isEquivalentReturnRequest(
            existingReturn,
            [{ orderLineId: 'line-1', quantity: 2, reason: null }],
            { orderId: 'order-1' },
            requestedByLine,
            'Defect',
            null,
        )).toBe(false);
    });

    it('returns false when reason differs', () => {
        const requestedByLine = new Map([['line-1', 2]]);
        expect(isEquivalentReturnRequest(
            existingReturn,
            [{ orderLineId: 'line-1', quantity: 2, reason: null }],
            { orderId: 'order-1' },
            requestedByLine,
            'Different reason',
            null,
        )).toBe(false);
    });
});
