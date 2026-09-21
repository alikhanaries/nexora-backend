import { NotFoundError } from '../../../shared/errors/index.js';
import { toCustomerSnapshotDto, toOrderDto, toOrderLineDto, } from './order-dto.js';
import { requireOrdersRead } from './order-permissions.js';
export class GetOrder {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireOrdersRead(this.deps.authorization, input.actorPermissions);
        const order = await this.deps.orders.findById(this.deps.queryable, input.tenantId, input.orderId);
        if (order === null) {
            throw new NotFoundError('Order was not found', {
                tenantId: input.tenantId,
                orderId: input.orderId,
            });
        }
        const lines = await this.deps.orders.listOrderLines(this.deps.queryable, input.tenantId, input.orderId);
        const customer = await this.deps.orders.findCustomerSnapshot(this.deps.queryable, input.tenantId, input.orderId);
        return {
            order: {
                ...toOrderDto(order),
                lines: lines.map(toOrderLineDto),
                customer: customer === null ? null : toCustomerSnapshotDto(customer),
            },
        };
    }
}
