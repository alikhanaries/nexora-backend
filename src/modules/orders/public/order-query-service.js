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
 *
 * @property {(tenantId: string, orderNumber: string, tx?: object) => Promise<object|null>} findOrderByOrderNumber
 * Returns an order DTO or null when not found by merchant order number.
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorPermissions: string[],
 *   statuses?: string[],
 *   channelId?: string,
 *   externalOrderReference?: string,
 *   externalOrderReferences?: string[],
 *   orderNumber?: string,
 *   orderNumbers?: string[],
 *   createdAfter?: Date,
 *   createdBefore?: Date,
 *   updatedAfter?: Date,
 *   updatedBefore?: Date,
 *   stockLocationId?: string,
 *   page?: number,
 *   pageSize?: number,
 * }) => Promise<{ items: object[], totalCount: number, page: number, pageSize: number }>} listOrders
 * Tenant-scoped page-based order listing with optional detail (lines and customer snapshot).
 */
export { DefaultOrderQueryService } from '../application/order-query-service.js';
