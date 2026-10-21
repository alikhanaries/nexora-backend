import { assertOrderTransition, OrderStatus } from './order-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   channelId: string,
 *   externalOrderReference: string | null,
 *   orderNumber: string,
 *   status: string,
 *   currency: string,
 *   subtotalMinor: number,
 *   discountMinor: number,
 *   taxMinor: number,
 *   shippingMinor: number,
 *   totalMinor: number,
 *   createdAt: Date,
 *   updatedAt: Date,
 *   confirmedAt: Date | null,
 *   cancelledAt: Date | null,
 *   shippedAt: Date | null,
 *   deliveredAt: Date | null,
 * }} Order
 */

/**
 * @param {Omit<Order, 'status' | 'confirmedAt' | 'cancelledAt' | 'shippedAt' | 'deliveredAt' | 'updatedAt'> & {
 *   status?: string,
 *   confirmedAt?: Date | null,
 *   cancelledAt?: Date | null,
 *   shippedAt?: Date | null,
 *   deliveredAt?: Date | null,
 *   updatedAt?: Date,
 * }} props
 * @returns {Order}
 */
export function createOrderEntity(props) {
    const now = props.createdAt ?? new Date();
    const status = props.status ?? OrderStatus.CONFIRMED;
    return {
        id: props.id,
        tenantId: props.tenantId,
        channelId: props.channelId,
        externalOrderReference: props.externalOrderReference,
        orderNumber: props.orderNumber,
        status,
        currency: props.currency,
        subtotalMinor: props.subtotalMinor,
        discountMinor: props.discountMinor,
        taxMinor: props.taxMinor,
        shippingMinor: props.shippingMinor,
        totalMinor: props.totalMinor,
        createdAt: now,
        updatedAt: props.updatedAt ?? now,
        confirmedAt: props.confirmedAt ?? (status === OrderStatus.CONFIRMED ? now : null),
        cancelledAt: props.cancelledAt ?? null,
        shippedAt: props.shippedAt ?? null,
        deliveredAt: props.deliveredAt ?? null,
    };
}

/**
 * @param {Order} props
 * @returns {Order}
 */
export function reconstituteOrder(props) {
    return { ...props };
}

/**
 * @param {Order} order
 * @param {string} next
 * @param {Date} [at]
 * @returns {Order}
 */
export function transitionOrderEntity(order, next, at = new Date()) {
    assertOrderTransition(order.status, next);
    return {
        ...order,
        status: next,
        updatedAt: at,
        ...(next === OrderStatus.CONFIRMED ? { confirmedAt: at } : {}),
        ...(next === OrderStatus.CANCELLED ? { cancelledAt: at } : {}),
        ...(next === OrderStatus.SHIPPED ? { shippedAt: at } : {}),
        ...(next === OrderStatus.DELIVERED ? { deliveredAt: at } : {}),
    };
}
