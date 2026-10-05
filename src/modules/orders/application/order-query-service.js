import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { toCustomerSnapshotDto, toOrderDto, toOrderLineDto } from './order-dto.js';
import { requireOrdersRead } from './order-permissions.js';
import { withOrderQueryable } from './resolve-order-queryable.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function clampPageSize(pageSize) {
    const requested = pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(requested) || requested < 1) {
        throw new ValidationError('Page size must be a positive integer');
    }
    return Math.min(requested, MAX_PAGE_SIZE);
}

function clampPage(page) {
    const requested = page ?? 1;
    if (!Number.isInteger(requested) || requested < 1) {
        throw new ValidationError('Page must be a positive integer');
    }
    return requested;
}

export class DefaultOrderQueryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getOrderById(tenantId, orderId, tx) {
        return withOrderQueryable(this.deps, tenantId, tx, async (queryable) => {
            const order = await this.deps.orders.findById(queryable, tenantId, orderId);
            if (order === null) {
                throw new NotFoundError('Order was not found', { tenantId, orderId });
            }
            return toOrderDto(order);
        });
    }
    async getOrderLines(tenantId, orderId, tx) {
        return withOrderQueryable(this.deps, tenantId, tx, async (queryable) => {
            const lines = await this.deps.orders.listOrderLines(queryable, tenantId, orderId);
            return lines.map(toOrderLineDto);
        });
    }
    async verifyOrderBelongsToTenant(tenantId, orderId, tx) {
        return this.getOrderById(tenantId, orderId, tx);
    }
    async findOrderById(tenantId, orderId, tx) {
        return withOrderQueryable(this.deps, tenantId, tx, async (queryable) => {
            const order = await this.deps.orders.findById(queryable, tenantId, orderId);
            return order === null ? null : toOrderDto(order);
        });
    }
    async findOrderByOrderNumber(tenantId, orderNumber, tx) {
        return withOrderQueryable(this.deps, tenantId, tx, async (queryable) => {
            const order = await this.deps.orders.findByOrderNumber(queryable, tenantId, orderNumber);
            return order === null ? null : toOrderDto(order);
        });
    }
    async listOrders(input) {
        requireOrdersRead(this.deps.authorization, input.actorPermissions);
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
        return withOrderQueryable(this.deps, input.tenantId, undefined, async (queryable) => {
            const totalCount = await this.deps.orders.count(queryable, input.tenantId, filters);
            const orders = await this.deps.orders.listPage(queryable, input.tenantId, filters, page, pageSize);
            const items = await Promise.all(orders.map(async (order) => {
                const lines = await this.deps.orders.listOrderLines(queryable, input.tenantId, order.id);
                const customer = await this.deps.orders.findCustomerSnapshot(queryable, input.tenantId, order.id);
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
}
