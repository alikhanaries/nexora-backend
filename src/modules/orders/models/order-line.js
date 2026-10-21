import { OrderLineStatus } from './order-line-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   orderId: string,
 *   productId: string,
 *   offerId: string | null,
 *   stockLocationId: string,
 *   merchantSku: string,
 *   productTypeSnapshot: string,
 *   quantity: number,
 *   cancelledQuantity: number,
 *   shippedQuantity: number,
 *   returnedQuantity: number,
 *   unitPriceMinor: number,
 *   discountMinor: number,
 *   taxMinor: number,
 *   lineTotalMinor: number,
 *   currency: string,
 *   status: string,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} OrderLine
 */

/**
 * @param {Omit<OrderLine, 'cancelledQuantity' | 'shippedQuantity' | 'returnedQuantity' | 'status' | 'updatedAt'> & {
 *   cancelledQuantity?: number,
 *   shippedQuantity?: number,
 *   returnedQuantity?: number,
 *   status?: string,
 *   updatedAt?: Date,
 * }} props
 * @returns {OrderLine}
 */
export function createOrderLineEntity(props) {
    const now = props.createdAt ?? new Date();
    return {
        id: props.id,
        tenantId: props.tenantId,
        orderId: props.orderId,
        productId: props.productId,
        offerId: props.offerId,
        stockLocationId: props.stockLocationId,
        merchantSku: props.merchantSku,
        productTypeSnapshot: props.productTypeSnapshot,
        quantity: props.quantity,
        cancelledQuantity: props.cancelledQuantity ?? 0,
        shippedQuantity: props.shippedQuantity ?? 0,
        returnedQuantity: props.returnedQuantity ?? 0,
        unitPriceMinor: props.unitPriceMinor,
        discountMinor: props.discountMinor,
        taxMinor: props.taxMinor,
        lineTotalMinor: props.lineTotalMinor,
        currency: props.currency,
        status: props.status ?? OrderLineStatus.OPEN,
        createdAt: now,
        updatedAt: props.updatedAt ?? now,
    };
}

/**
 * @param {OrderLine} props
 * @returns {OrderLine}
 */
export function reconstituteOrderLine(props) {
    return { ...props };
}

/**
 * @param {OrderLine} line
 * @returns {number}
 */
export function orderLineCancellableQuantity(line) {
    return line.quantity - line.cancelledQuantity - line.shippedQuantity;
}

/**
 * @param {OrderLine} line
 * @returns {number}
 */
export function orderLineShippableQuantity(line) {
    return line.quantity - line.cancelledQuantity - line.shippedQuantity;
}

/**
 * @param {OrderLine} line
 * @returns {number}
 */
export function orderLineReturnableQuantity(line) {
    return line.shippedQuantity - line.returnedQuantity;
}

/**
 * @param {OrderLine} line
 * @param {Partial<Pick<OrderLine, 'cancelledQuantity' | 'shippedQuantity' | 'returnedQuantity' | 'status' | 'updatedAt'>>} patch
 * @returns {OrderLine}
 */
export function withOrderLineUpdatedQuantities(line, patch) {
    return {
        ...line,
        ...patch,
        updatedAt: patch.updatedAt ?? new Date(),
    };
}
