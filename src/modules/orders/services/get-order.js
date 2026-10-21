import { NotFoundError } from '../../../shared/errors/index.js';
import { toCustomerSnapshotDto, toOrderDto, toOrderLineDto, } from '../views/order-dto.js';
import { requireOrdersRead } from './order-permissions.js';

/**
 * @param {object} deps
 * @param {import('../../authorization/public/index.js').AuthorizationService} deps.authorization
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresQueryable} deps.queryable
 * @param {import('../repositories/postgres-order-repository.js').PostgresOrderRepository} deps.orders
 */
export function createGetOrder(deps) {
    /**
     * Order command/query step: tenant isolation on all repository calls; may emit order.* events for outbound webhooks.
     */
    async function execute(input) {
        requireOrdersRead(deps.authorization, input.actorPermissions);
        const order = await deps.orders.findById(deps.queryable, input.tenantId, input.orderId);
        if (order === null) {
            throw new NotFoundError('Order was not found', {
                tenantId: input.tenantId,
                orderId: input.orderId,
            });
        }
        const lines = await deps.orders.listOrderLines(deps.queryable, input.tenantId, input.orderId);
        const customer = await deps.orders.findCustomerSnapshot(deps.queryable, input.tenantId, input.orderId);
        return {
            order: {
                ...toOrderDto(order),
                lines: lines.map(toOrderLineDto),
                customer: customer === null ? null : toCustomerSnapshotDto(customer),
            },
        };
    }

    return { execute };
}
