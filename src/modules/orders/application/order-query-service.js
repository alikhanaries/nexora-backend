import { NotFoundError } from '../../../shared/errors/index.js';
import { toOrderDto, toOrderLineDto } from './order-dto.js';
export class DefaultOrderQueryService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getOrderById(tenantId, orderId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const order = await this.deps.orders.findById(queryable, tenantId, orderId);
        if (order === null) {
            throw new NotFoundError('Order was not found', { tenantId, orderId });
        }
        return toOrderDto(order);
    }
    async getOrderLines(tenantId, orderId, tx) {
        const queryable = tx ?? this.deps.queryable;
        const lines = await this.deps.orders.listOrderLines(queryable, tenantId, orderId);
        return lines.map(toOrderLineDto);
    }
    async verifyOrderBelongsToTenant(tenantId, orderId, tx) {
        return this.getOrderById(tenantId, orderId, tx);
    }
}
