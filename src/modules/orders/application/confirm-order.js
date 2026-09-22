import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { OrderStatus } from '../domain/order-status.js';
import { toCustomerSnapshotDto, toOrderDto, toOrderLineDto, } from './order-dto.js';
import { orderConfirmedEvent, orderStatusChangedEvent } from './order-events.js';
import { requireOrdersUpdate } from './order-permissions.js';
export class ConfirmOrder {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireOrdersUpdate(this.deps.authorization, input.actorPermissions);
        if (input.transaction !== undefined) {
            const order = await this.confirmInTransaction(input.transaction, input);
            return { order };
        }
        const order = await this.deps.database.execute(async (tx) => this.confirmInTransaction(tx, input), { tenantId: input.tenantId });
        return { order };
    }

    /**
     * @param {object} tx
     * @param {object} input
     */
    async confirmInTransaction(tx, input) {
        const existing = await this.deps.orders.lockOrderForUpdate(tx, input.tenantId, input.orderId);
        if (existing === null) {
            throw new NotFoundError('Order was not found', {
                tenantId: input.tenantId,
                orderId: input.orderId,
            });
        }
        if (existing.status === OrderStatus.CONFIRMED) {
            const lines = await this.deps.orders.listOrderLines(tx, input.tenantId, input.orderId);
            const customer = await this.deps.orders.findCustomerSnapshot(tx, input.tenantId, input.orderId);
            return {
                ...toOrderDto(existing),
                lines: lines.map(toOrderLineDto),
                customer: customer === null ? null : toCustomerSnapshotDto(customer),
            };
        }
        let updated;
        try {
            updated = existing.transitionTo(OrderStatus.CONFIRMED);
        }
        catch {
            throw new BusinessRuleError('Order cannot be confirmed in its current status', {
                orderId: input.orderId,
                status: existing.status,
            });
        }
        await this.deps.orders.updateOrder(tx, updated);
        const orderDto = toOrderDto(updated);
        await this.deps.eventRecorder.record(tx, orderStatusChangedEvent(orderDto, existing.status));
        await this.deps.eventRecorder.record(tx, orderConfirmedEvent(orderDto));
        await this.deps.auditRecorder?.record(tx, {
            tenantId: input.tenantId,
            actorKind: input.actorKind,
            actorId: input.actorId,
            eventType: 'ORDER_STATUS_CHANGED',
            resourceType: 'order',
            resourceId: updated.id,
            metadata: {
                fromStatus: existing.status,
                toStatus: updated.status,
                orderNumber: updated.orderNumber,
            },
            ...auditRequestFields(),
        });
        const lines = await this.deps.orders.listOrderLines(tx, input.tenantId, input.orderId);
        const customer = await this.deps.orders.findCustomerSnapshot(tx, input.tenantId, input.orderId);
        return {
            ...orderDto,
            lines: lines.map(toOrderLineDto),
            customer: customer === null ? null : toCustomerSnapshotDto(customer),
        };
    }
}
