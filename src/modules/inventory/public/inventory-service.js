/**
 * @typedef {object} InventoryService
 * Cross-module inventory mutations and availability reads.
 *
 * @property {(tenantId: string, productId: string, stockLocationId?: string, tx?: object) => Promise<object>} getAvailability
 * Returns on-hand, reserved, and available quantities.
 *
 * @property {(input: object, tx?: object) => Promise<object>} reserve
 * Reserves stock for a reference. Idempotent per referenceType/referenceId. Participates in tx when provided.
 *
 * @property {(input: object, tx?: object) => Promise<object>} release
 * Releases a prior reservation. Idempotent per reference.
 *
 * @property {(input: object, tx?: object) => Promise<object>} fulfillReservedForShipment
 * Consumes reserved and on-hand stock when a shipment is marked SHIPPED (ADR-027).
 *
 * @property {(input: object, tx?: object) => Promise<object>} adjust
 * @property {(input: object, tx?: object) => Promise<object>} receive
 * @property {(input: object, tx?: object) => Promise<object>} recordSale
 * @property {(input: object, tx?: object) => Promise<object>} recordReturn
 * Mutate on-hand inventory with audit/outbox side effects inside the caller transaction when tx is supplied.
 *
 * @property {(tenantId: string, stockLocationId: string, tx?: object) => Promise<void>} verifyUsableStockLocation
 * Ensures the stock location exists for the tenant and is active.
 */
export { DefaultInventoryService } from '../application/default-inventory-service.js';
