import { clampCursorLimit, decodeCursor, encodeCursor, } from '../../../shared/pagination/index.js';
import { toOrderDto } from '../views/order-dto.js';
import { requireOrdersRead } from './order-permissions.js';

/**
 * Service-layer cursor encoding wrapping repository tuple.
 */
function encodeOrderListCursor(order) {
    return encodeCursor([order.createdAt.toISOString(), order.id]);
}

/**
 * Cursor-paginated order list for the public HTTP API (Nest `OrdersService.listOrders`).
 *
 * @param {object} deps
 * @param {import('../../authorization/public/index.js').AuthorizationService} deps.authorization
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresQueryable} deps.queryable
 * @param {import('../repositories/postgres-order-repository.js').PostgresOrderRepository} deps.orders
 */
export function createListOrders(deps) {
    /**
     * Order command/query step: tenant isolation on all repository calls; may emit order.* events for outbound webhooks.
     */
    async function execute(input) {
        requireOrdersRead(deps.authorization, input.actorPermissions);
        const limit = clampCursorLimit(input.limit);
        const cursor = input.cursor === undefined ? undefined : decodeCursor(input.cursor);
        const fetchLimit = limit + 1;
        const rows = await deps.orders.list(deps.queryable, input.tenantId, {
            ...(input.status === undefined ? {} : { status: input.status }),
            ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            ...(input.externalOrderReference === undefined
                ? {}
                : { externalOrderReference: input.externalOrderReference }),
            ...(input.orderNumber === undefined ? {} : { orderNumber: input.orderNumber }),
            ...(input.createdAfter === undefined ? {} : { createdAfter: input.createdAfter }),
            ...(input.createdBefore === undefined ? {} : { createdBefore: input.createdBefore }),
            ...(input.updatedAfter === undefined ? {} : { updatedAfter: input.updatedAfter }),
            ...(input.updatedBefore === undefined ? {} : { updatedBefore: input.updatedBefore }),
        }, fetchLimit, cursor);
        const hasMore = rows.length > limit;
        const pageItems = hasMore ? rows.slice(0, limit) : rows;
        const last = pageItems.at(-1);
        return {
            items: pageItems.map((order) => toOrderDto(order)),
            nextCursor: hasMore && last !== undefined ? encodeOrderListCursor(last) : null,
            hasMore,
        };
    }

    return { execute };
}
