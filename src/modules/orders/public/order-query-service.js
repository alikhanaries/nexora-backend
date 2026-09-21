/**
 * @typedef {object} OrderQueryService
 * Read-only order access for cross-module callers.
 *
 * @property {(tenantId: string, orderId: string, tx?: object) => Promise<object>} getOrderById
 * Returns an order DTO. Throws {@link NotFoundError} when missing.
 *
 * @property {(tenantId: string, orderId: string, tx?: object) => Promise<object[]>} getOrderLines
 * Returns order line DTOs for an order.
 *
 * @property {(tenantId: string, orderId: string, tx?: object) => Promise<object>} verifyOrderBelongsToTenant
 * Same as getOrderById; validates tenant ownership.
 *
 * @property {(tenantId: string, orderId: string, tx?: object) => Promise<object|null>} findOrderById
 * Returns an order DTO or null when not found.
 */
export { DefaultOrderQueryService } from '../application/order-query-service.js';
