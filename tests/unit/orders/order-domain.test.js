import { describe, expect, it } from 'vitest';
import { Order } from '../../../src/modules/orders/domain/order.js';
import { OrderStatus } from '../../../src/modules/orders/domain/order-status.js';

describe('Order domain', () => {
    it('creates CONFIRMED orders with confirmedAt by default', () => {
        const createdAt = new Date('2026-01-01T00:00:00.000Z');
        const order = Order.create({
            id: 'order-1',
            tenantId: 'tenant-1',
            channelId: 'channel-1',
            externalOrderReference: null,
            orderNumber: 'ORD-00000001',
            currency: 'USD',
            subtotalMinor: 1000,
            discountMinor: 0,
            taxMinor: 0,
            shippingMinor: 0,
            totalMinor: 1000,
            createdAt,
        });

        expect(order.status).toBe(OrderStatus.CONFIRMED);
        expect(order.confirmedAt).toEqual(createdAt);
    });

    it('creates NEW orders without confirmedAt', () => {
        const createdAt = new Date('2026-01-01T00:00:00.000Z');
        const order = Order.create({
            id: 'order-1',
            tenantId: 'tenant-1',
            channelId: 'channel-1',
            externalOrderReference: 'EXT-001',
            orderNumber: 'ORD-00000001',
            status: OrderStatus.NEW,
            currency: 'USD',
            subtotalMinor: 1000,
            discountMinor: 0,
            taxMinor: 0,
            shippingMinor: 0,
            totalMinor: 1000,
            createdAt,
        });

        expect(order.status).toBe(OrderStatus.NEW);
        expect(order.confirmedAt).toBeNull();
    });
});
