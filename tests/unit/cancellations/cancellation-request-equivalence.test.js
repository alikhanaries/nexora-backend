import { describe, expect, it } from 'vitest';
import { isEquivalentCancellationRequest } from '../../../src/modules/cancellations/application/cancellation-request-equivalence.js';

describe('cancellation request equivalence', () => {
    const existingCancellation = {
        orderId: 'order-1',
        reason: 'Customer request',
    };

    it('returns true for equivalent line quantities and reason', () => {
        const requestedByLine = new Map([['line-1', 2]]);
        expect(isEquivalentCancellationRequest(
            existingCancellation,
            [{ orderLineId: 'line-1', quantity: 2 }],
            { orderId: 'order-1' },
            requestedByLine,
            'Customer request',
        )).toBe(true);
    });

    it('returns false when quantities differ', () => {
        const requestedByLine = new Map([['line-1', 3]]);
        expect(isEquivalentCancellationRequest(
            existingCancellation,
            [{ orderLineId: 'line-1', quantity: 2 }],
            { orderId: 'order-1' },
            requestedByLine,
            'Customer request',
        )).toBe(false);
    });

    it('returns false when reason differs', () => {
        const requestedByLine = new Map([['line-1', 2]]);
        expect(isEquivalentCancellationRequest(
            existingCancellation,
            [{ orderLineId: 'line-1', quantity: 2 }],
            { orderId: 'order-1' },
            requestedByLine,
            'Different reason',
        )).toBe(false);
    });
});
