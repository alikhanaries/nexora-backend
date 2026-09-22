import { describe, expect, it } from 'vitest';
import { isEquivalentShipmentRequest } from '../../../src/modules/shipments/application/shipment-request-equivalence.js';

describe('shipment request equivalence', () => {
    it('matches equivalent shipment requests', () => {
        const requestedByLine = new Map([['line-1', 2]]);
        expect(isEquivalentShipmentRequest(
            { orderId: 'order-1', carrier: 'DHL', trackingNumber: 'TT-1' },
            [{ orderLineId: 'line-1', quantity: 2 }],
            { orderId: 'order-1' },
            requestedByLine,
            'DHL',
            'TT-1',
        )).toBe(true);
    });

    it('rejects different quantities', () => {
        const requestedByLine = new Map([['line-1', 3]]);
        expect(isEquivalentShipmentRequest(
            { orderId: 'order-1', carrier: 'DHL', trackingNumber: 'TT-1' },
            [{ orderLineId: 'line-1', quantity: 2 }],
            { orderId: 'order-1' },
            requestedByLine,
            'DHL',
            'TT-1',
        )).toBe(false);
    });

    it('rejects different orders', () => {
        const requestedByLine = new Map([['line-1', 2]]);
        expect(isEquivalentShipmentRequest(
            { orderId: 'order-1', carrier: null, trackingNumber: null },
            [{ orderLineId: 'line-1', quantity: 2 }],
            { orderId: 'order-2' },
            requestedByLine,
            null,
            null,
        )).toBe(false);
    });
});
