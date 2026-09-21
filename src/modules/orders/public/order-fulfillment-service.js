/**
 * @typedef {object} OrderFulfillmentService
 * Coordinates order-line quantity changes for shipments and cancellations.
 *
 * @property {(transaction: object, input: object) => Promise<object>} applyCancellation
 * Locks the order, applies cancellation quantities to lines, and may transition order status.
 * Must run inside the caller transaction.
 *
 * @property {(tenantId: string, orderId: string, tx: object) => Promise<object[]>} lockOrderLinesForFulfillment
 * Locks order lines for shipment/cancellation work. Throws when order cannot be fulfilled.
 *
 * @property {(tenantId: string, orderId: string, lines: object[], tx: object) => Promise<void>} applyShipmentQuantities
 * Increments shipped quantities on locked order lines.
 *
 * @property {(tenantId: string, orderId: string, lines: object[], tx: object) => Promise<void>} reverseShipmentQuantities
 * Decrements shipped quantities when a shipment is reversed.
 *
 * @property {(tenantId: string, orderId: string, tx: object) => Promise<void>} evaluateOrderShipmentState
 * Advances order status when all non-cancelled lines are fully shipped.
 */
export { DefaultOrderFulfillmentService } from '../application/order-fulfillment-service.js';
