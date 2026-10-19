import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { OrderStatus } from '../models/order-status.js';
import { toCustomerSnapshotDto, toOrderDto, toOrderLineDto, } from '../views/order-dto.js';
import { orderConfirmedEvent, orderStatusChangedEvent } from './order-events.js';
import { requireOrdersUpdate } from './order-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createConfirmOrder(deps) {
    /**
     * @param {object} tx
     * @param {object} input
     */
    async function confirmInTransaction(tx, input) {
        const existing = await deps.orders.lockOrderForUpdate(tx, input.tenantId, input.orderId);
        if (existing === null) {
            throw new NotFoundError('Order was not found', {
                tenantId: input.tenantId,
                orderId: input.orderId,
            });
        }
        if (existing.status === OrderStatus.CONFIRMED) {
            const lines = await deps.orders.listOrderLines(tx, input.tenantId, input.orderId);
            const customer = await deps.orders.findCustomerSnapshot(tx, input.tenantId, input.orderId);
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
        await deps.orders.updateOrder(tx, updated);
        const orderDto = toOrderDto(updated);
        await deps.eventRecorder.record(tx, orderStatusChangedEvent(orderDto, existing.status));
        await deps.eventRecorder.record(tx, orderConfirmedEvent(orderDto));
        await deps.auditRecorder?.record(tx, {
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
        const lines = await deps.orders.listOrderLines(tx, input.tenantId, input.orderId);
        const customer = await deps.orders.findCustomerSnapshot(tx, input.tenantId, input.orderId);
        return {
            ...orderDto,
            lines: lines.map(toOrderLineDto),
            customer: customer === null ? null : toCustomerSnapshotDto(customer),
        };
    }

    async function execute(input) {
        requireOrdersUpdate(deps.authorization, input.actorPermissions);
        if (input.transaction !== undefined) {
            const order = await confirmInTransaction(input.transaction, input);
            return { order };
        }
        const order = await deps.database.execute(async (tx) => confirmInTransaction(tx, input), { tenantId: input.tenantId });
        return { order };
    }

    return { execute };
}
