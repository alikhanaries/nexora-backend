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
export function canTransitionOrderStatus(from, to) {
    return LEGAL_TRANSITIONS[from].includes(to);
}
export function assertOrderTransition(from, to) {
    if (!canTransitionOrderStatus(from, to)) {
        throw new Error(`Invalid order status transition from ${from} to ${to}`);
    }
}
export function isOrderCancellable(status) {
    return (status === OrderStatus.NEW ||
        status === OrderStatus.CONFIRMED ||
        status === OrderStatus.PROCESSING ||
        status === OrderStatus.READY_TO_SHIP);
}
