import { describe, expect, it } from 'vitest';
import { OrderStatus, canTransitionOrderStatus, isOrderCancellable, } from '../../../src/modules/orders/domain/order-status.js';
describe('order status machine', () => {
    it('allows the primary fulfillment lifecycle', () => {
        expect(canTransitionOrderStatus(OrderStatus.NEW, OrderStatus.CONFIRMED)).toBe(true);
        expect(canTransitionOrderStatus(OrderStatus.CONFIRMED, OrderStatus.PROCESSING)).toBe(true);
        expect(canTransitionOrderStatus(OrderStatus.PROCESSING, OrderStatus.READY_TO_SHIP)).toBe(true);
        expect(canTransitionOrderStatus(OrderStatus.READY_TO_SHIP, OrderStatus.SHIPPED)).toBe(true);
        expect(canTransitionOrderStatus(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
        expect(canTransitionOrderStatus(OrderStatus.DELIVERED, OrderStatus.RETURNED)).toBe(true);
    });
    it('rejects illegal backward transitions', () => {
        expect(canTransitionOrderStatus(OrderStatus.DELIVERED, OrderStatus.NEW)).toBe(false);
        expect(canTransitionOrderStatus(OrderStatus.CANCELLED, OrderStatus.PROCESSING)).toBe(false);
        expect(canTransitionOrderStatus(OrderStatus.RETURNED, OrderStatus.SHIPPED)).toBe(false);
    });
    it('identifies cancellable states before shipment', () => {
        expect(isOrderCancellable(OrderStatus.NEW)).toBe(true);
        expect(isOrderCancellable(OrderStatus.CONFIRMED)).toBe(true);
        expect(isOrderCancellable(OrderStatus.READY_TO_SHIP)).toBe(true);
        expect(isOrderCancellable(OrderStatus.SHIPPED)).toBe(false);
        expect(isOrderCancellable(OrderStatus.DELIVERED)).toBe(false);
    });
});
