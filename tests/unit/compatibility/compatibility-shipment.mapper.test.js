import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import {
    fingerprintShipmentCommand,
    mapExternalShipmentLinesToOrderLines,
    mapExternalShipmentRequest,
    mapShipmentResultToExternalResponse,
} from '../../../src/modules/compatibility/application/mappers/compatibility-shipment.mapper.js';

describe('compatibility shipment mapper', () => {
    it('maps MerchantOrderNo and tracking fields', () => {
        expect(mapExternalShipmentRequest({
            MerchantShipmentNo: ' SHIP-1 ',
            MerchantOrderNo: ' ORD-1 ',
            Lines: [{ MerchantProductNo: 'SKU-A', Quantity: 2 }],
            Method: ' DHL ',
            TrackTraceNo: ' TT-1 ',
        })).toEqual({
            orderNumber: 'ORD-1',
            merchantShipmentNo: 'SHIP-1',
            externalLines: [{ MerchantProductNo: 'SKU-A', Quantity: 2 }],
            carrier: 'DHL',
            trackingNumber: 'TT-1',
        });
    });

    it('maps merchant SKU to order line allocations', () => {
        const lines = mapExternalShipmentLinesToOrderLines(
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
        const lines = mapExternalShipmentLinesToOrderLines(
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
        expect(() => mapExternalShipmentLinesToOrderLines(
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
        expect(mapShipmentResultToExternalResponse({ shipment: { id: 'ship-1' } })).toEqual({
            Success: true,
            StatusCode: 201,
            Message: null,
        });
    });

    it('fingerprints mapped shipment command input', () => {
        const fingerprint = fingerprintShipmentCommand({
            orderNumber: 'ORD-1',
            merchantShipmentNo: 'SHIP-1',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            carrier: 'DHL',
            trackingNumber: 'TT-1',
        });
        expect(fingerprint).toContain('ORD-1');
        expect(fingerprint).toContain('SHIP-1');
        expect(fingerprint).not.toContain('999001');
    });
});
