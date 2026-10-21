/**
 * Read-side order API: list/get with permission checks and DTO mapping.
 */
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { toCustomerSnapshotDto, toOrderDto, toOrderLineDto } from '../views/order-dto.js';
import { requireOrdersRead } from './order-permissions.js';
import { withOrderQueryable } from './resolve-order-queryable.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * Validates and caps cross-module order list pagination inputs.
 */
function clampPageSize(pageSize) {
    const requested = pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(requested) || requested < 1) {
        throw new ValidationError('Page size must be a positive integer');
    }
    return Math.min(requested, MAX_PAGE_SIZE);
}

/**
 * Validates and caps cross-module order list pagination inputs.
 */
function clampPage(page) {
    const requested = page ?? 1;
    if (!Number.isInteger(requested) || requested < 1) {
        throw new ValidationError('Page must be a positive integer');
    }
    return requested;
}

/**
 * Cross-module read-only order query API (page-based list, find-by-id/number, lines).
 *
 * @param {object} deps
 * @param {import('../../authorization/public/index.js').AuthorizationService} deps.authorization
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresQueryable} deps.queryable
 * @param {import('../repositories/postgres-order-repository.js').PostgresOrderRepository} deps.orders
 */
export function createOrderQueryService(deps) {
    /**
     * Tenant-scoped order fetch with NotFound on getOrderById.
     */
    async function getOrderById(tenantId, orderId, tx) {
        return withOrderQueryable(deps, tenantId, tx, async (queryable) => {
            const order = await deps.orders.findById(queryable, tenantId, orderId);
            if (order === null) {
                throw new NotFoundError('Order was not found', { tenantId, orderId });
            }
            return toOrderDto(order);
        });
    }

    /**
     * Lists order lines as DTOs within optional caller transaction.
     */
    async function getOrderLines(tenantId, orderId, tx) {
        return withOrderQueryable(deps, tenantId, tx, async (queryable) => {
            const lines = await deps.orders.listOrderLines(queryable, tenantId, orderId);
            return lines.map(toOrderLineDto);
        });
    }

    /**
     * Alias of getOrderById for cross-module guard before mutations.
     */
    async function verifyOrderBelongsToTenant(tenantId, orderId, tx) {
        return getOrderById(tenantId, orderId, tx);
    }

    /**
     * Tenant-scoped order fetch with NotFound on getOrderById.
     */
    async function findOrderById(tenantId, orderId, tx) {
        return withOrderQueryable(deps, tenantId, tx, async (queryable) => {
            const order = await deps.orders.findById(queryable, tenantId, orderId);
            return order === null ? null : toOrderDto(order);
        });
    }

    /**
     * Nullable find by display order number.
     */
    async function findOrderByOrderNumber(tenantId, orderNumber, tx) {
        return withOrderQueryable(deps, tenantId, tx, async (queryable) => {
            const order = await deps.orders.findByOrderNumber(queryable, tenantId, orderNumber);
            return order === null ? null : toOrderDto(order);
        });
    }

    /**
     * Page-based order search with lines+customer hydration; requires orders.read.
     */
    async function listOrders(input) {
        requireOrdersRead(deps.authorization, input.actorPermissions);
        const page = clampPage(input.page);
        const pageSize = clampPageSize(input.pageSize);
        const filters = {
            ...(input.statuses === undefined ? {} : { statuses: input.statuses }),
            ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            ...(input.externalOrderReference === undefined
                ? {}
                : { externalOrderReference: input.externalOrderReference }),
            ...(input.externalOrderReferences === undefined
                ? {}
                : { externalOrderReferences: input.externalOrderReferences }),
            ...(input.orderNumber === undefined ? {} : { orderNumber: input.orderNumber }),
            ...(input.orderNumbers === undefined ? {} : { orderNumbers: input.orderNumbers }),
            ...(input.createdAfter === undefined ? {} : { createdAfter: input.createdAfter }),
            ...(input.createdBefore === undefined ? {} : { createdBefore: input.createdBefore }),
            ...(input.updatedAfter === undefined ? {} : { updatedAfter: input.updatedAfter }),
            ...(input.updatedBefore === undefined ? {} : { updatedBefore: input.updatedBefore }),
            ...(input.stockLocationId === undefined
                ? {}
                : { stockLocationId: input.stockLocationId }),
        };
        return withOrderQueryable(deps, input.tenantId, undefined, async (queryable) => {
            const totalCount = await deps.orders.count(queryable, input.tenantId, filters);
            const orders = await deps.orders.listPage(queryable, input.tenantId, filters, page, pageSize);
            const items = await Promise.all(orders.map(async (order) => {
                const lines = await deps.orders.listOrderLines(queryable, input.tenantId, order.id);
                const customer = await deps.orders.findCustomerSnapshot(queryable, input.tenantId, order.id);
                return {
                    ...toOrderDto(order),
                    lines: lines.map(toOrderLineDto),
                    customer: customer === null ? null : toCustomerSnapshotDto(customer),
                };
            }));
            return {
                items,
                totalCount,
                page,
                pageSize,
            };
        });
    }

    return {
        getOrderById,
        getOrderLines,
        verifyOrderBelongsToTenant,
        findOrderById,
        findOrderByOrderNumber,
        listOrders,
    };
}
