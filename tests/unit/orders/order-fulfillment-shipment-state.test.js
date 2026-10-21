import { describe, expect, it, vi } from 'vitest';
import { createOrderFulfillmentService } from '../../../src/modules/orders/services/order-fulfillment-service.js';
import { OrderStatus } from '../../../src/modules/orders/models/order-status.js';

describe('order fulfillment shipment state', () => {
    it('does not advance order status when lines are only partially shipped', async () => {
        const order = {
            id: 'order-1',
            tenantId: 'tenant-1',
            status: OrderStatus.CONFIRMED,
        };
        const orders = {
            findById: vi.fn(async () => order),
            listOrderLines: vi.fn(async () => [
                {
                    id: 'line-1',
                    quantity: 10,
                    cancelledQuantity: 0,
                    shippedQuantity: 4,
                },
            ]),
            updateOrder: vi.fn(),
        };
        const eventRecorder = { record: vi.fn() };
        const service = createOrderFulfillmentService({ orders, eventRecorder: eventRecorder });

        await service.evaluateOrderShipmentState('tenant-1', 'order-1', {});

        expect(orders.updateOrder).not.toHaveBeenCalled();
        expect(eventRecorder.record).not.toHaveBeenCalled();
    });

    it('advances confirmed order through shipment chain when all lines are fully shipped', async () => {
        let stored = {
            id: 'order-1',
            tenantId: 'tenant-1',
            status: OrderStatus.CONFIRMED,
        };
        const orders = {
            findById: vi.fn(async () => stored),
            listOrderLines: vi.fn(async () => [
                {
                    id: 'line-1',
                    quantity: 5,
                    cancelledQuantity: 0,
                    shippedQuantity: 5,
                },
            ]),
            updateOrder: vi.fn(async (_tx, updated) => {
                stored = updated;
            }),
        };
        const eventRecorder = { record: vi.fn() };
        const service = createOrderFulfillmentService({ orders, eventRecorder });

        await service.evaluateOrderShipmentState('tenant-1', 'order-1', {});

        expect(stored.status).toBe(OrderStatus.SHIPPED);
        expect(orders.updateOrder).toHaveBeenCalledTimes(1);
        expect(eventRecorder.record).toHaveBeenCalledTimes(1);
    });
});
