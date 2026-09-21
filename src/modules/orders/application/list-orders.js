import { clampCursorLimit, decodeCursor, encodeCursor, } from '../../../shared/pagination/index.js';
import { toOrderDto } from './order-dto.js';
import { requireOrdersRead } from './order-permissions.js';
function encodeOrderListCursor(order) {
    return encodeCursor([order.createdAt.toISOString(), order.id]);
}
export class ListOrders {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireOrdersRead(this.deps.authorization, input.actorPermissions);
        const limit = clampCursorLimit(input.limit);
        const cursor = input.cursor === undefined ? undefined : decodeCursor(input.cursor);
        const fetchLimit = limit + 1;
        const rows = await this.deps.orders.list(this.deps.queryable, input.tenantId, {
            ...(input.status === undefined ? {} : { status: input.status }),
            ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
            ...(input.externalOrderReference === undefined
                ? {}
                : { externalOrderReference: input.externalOrderReference }),
            ...(input.orderNumber === undefined ? {} : { orderNumber: input.orderNumber }),
            ...(input.createdAfter === undefined ? {} : { createdAfter: input.createdAfter }),
            ...(input.createdBefore === undefined ? {} : { createdBefore: input.createdBefore }),
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
}
