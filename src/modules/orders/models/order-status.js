export const OrderStatus = {
    NEW: 'NEW',
    CONFIRMED: 'CONFIRMED',
    PROCESSING: 'PROCESSING',
    READY_TO_SHIP: 'READY_TO_SHIP',
    SHIPPED: 'SHIPPED',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
    RETURNED: 'RETURNED',
};
const LEGAL_TRANSITIONS = {
    [OrderStatus.NEW]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.READY_TO_SHIP, OrderStatus.CANCELLED],
    [OrderStatus.READY_TO_SHIP]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
    [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.RETURNED]: [],
};
/**
 * Pure check against allowed order status graph (fulfillment and cancellation rules).
 */
export function canTransitionOrderStatus(from, to) {
    return LEGAL_TRANSITIONS[from].includes(to);
}
/**
 * Throws when status change violates LEGAL_TRANSITIONS (used before persist).
 */
export function assertOrderTransition(from, to) {
    if (!canTransitionOrderStatus(from, to)) {
        throw new Error(`Invalid order status transition from ${from} to ${to}`);
    }
}
/**
 * True while order is pre-shipment (NEW through READY_TO_SHIP).
 */
export function isOrderCancellable(status) {
    return (status === OrderStatus.NEW ||
        status === OrderStatus.CONFIRMED ||
        status === OrderStatus.PROCESSING ||
        status === OrderStatus.READY_TO_SHIP);
}
