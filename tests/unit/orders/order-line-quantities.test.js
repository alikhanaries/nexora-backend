import { describe, expect, it } from 'vitest';
import {
    createOrderLineEntity,
    orderLineCancellableQuantity,
    orderLineReturnableQuantity,
    orderLineShippableQuantity,
    withOrderLineUpdatedQuantities,
} from '../../../src/modules/orders/models/order-line.js';
import { OrderLineStatus } from '../../../src/modules/orders/models/order-line-status.js';

describe('order line quantity helpers', () => {
    const baseLine = createOrderLineEntity({
        id: 'line-1',
        tenantId: 'tenant-1',
        orderId: 'order-1',
        productId: 'product-1',
        stockLocationId: 'loc-1',
        quantity: 10,
        unitPriceMinor: 100,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    it('derives cancellable and shippable quantity from shipped and cancelled amounts', () => {
        const line = withOrderLineUpdatedQuantities(baseLine, {
            cancelledQuantity: 2,
            shippedQuantity: 3,
        });
        expect(orderLineCancellableQuantity(line)).toBe(5);
        expect(orderLineShippableQuantity(line)).toBe(5);
        expect(orderLineReturnableQuantity(line)).toBe(3);
    });

    it('closes a line when shipped quantity covers non-cancelled units', () => {
        const line = withOrderLineUpdatedQuantities(baseLine, {
            cancelledQuantity: 2,
            shippedQuantity: 8,
            status: OrderLineStatus.OPEN,
        });
        const shippedQuantity = line.shippedQuantity + 0;
        const nextStatus = shippedQuantity >= line.quantity - line.cancelledQuantity
            ? OrderLineStatus.CLOSED
            : line.status;
        expect(nextStatus).toBe(OrderLineStatus.CLOSED);
    });

    it('keeps line open after partial shipment', () => {
        const line = withOrderLineUpdatedQuantities(baseLine, {
            shippedQuantity: 4,
            status: OrderLineStatus.OPEN,
        });
        const shippedQuantity = line.shippedQuantity;
        const nextStatus = shippedQuantity >= line.quantity - line.cancelledQuantity
            ? OrderLineStatus.CLOSED
            : line.status;
        expect(nextStatus).toBe(OrderLineStatus.OPEN);
        expect(orderLineShippableQuantity(line)).toBe(6);
    });
});
