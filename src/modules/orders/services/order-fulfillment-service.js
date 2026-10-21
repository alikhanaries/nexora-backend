import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import {
    orderLineCancellableQuantity,
    orderLineShippableQuantity,
    withOrderLineUpdatedQuantities,
} from '../models/order-line.js';
import { OrderLineStatus } from '../models/order-line-status.js';
import { transitionOrderEntity } from '../models/order.js';
import { OrderStatus, isOrderCancellable } from '../models/order-status.js';
import { toOrderDto } from '../views/order-dto.js';
import { orderCancelledEvent, orderStatusChangedEvent } from './order-events.js';

/**
 * @param {object} deps
 * @param {ReturnType<import('../repositories/postgres-order-repository.js').createPostgresOrderRepository>} deps.orders
 * @param {object} deps.eventRecorder
 */
export function createOrderFulfillmentService(deps) {
    async function applyCancellation(transaction, input) {
        const order = await deps.orders.lockOrderForUpdate(transaction, input.tenantId, input.orderId);
        if (order === null) {
            throw new NotFoundError('Order was not found', {
                tenantId: input.tenantId,
                orderId: input.orderId,
            });
        }
        if (!isOrderCancellable(order.status)) {
            throw new BusinessRuleError('Order cannot be cancelled in its current status', {
                orderId: input.orderId,
                status: order.status,
            });
        }
        const lockedLines = await deps.orders.lockOrderLinesForUpdate(transaction, input.tenantId, input.orderId);
        if (lockedLines.length === 0) {
            throw new BusinessRuleError('Order has no lines to cancel');
        }
        const lineById = new Map(lockedLines.map((line) => [line.id, line]));
        const updates = input.lines.length === 0
            ? lockedLines
                .filter((line) => orderLineCancellableQuantity(line) > 0)
                .map((line) => ({ orderLineId: line.id, quantity: orderLineCancellableQuantity(line) }))
            : input.lines;
        if (updates.length === 0) {
            throw new BusinessRuleError('No cancellable quantity remains on this order');
        }
        const now = new Date();
        const appliedLines = [];
        for (const update of updates) {
            if (!Number.isInteger(update.quantity) || update.quantity <= 0) {
                throw new ValidationError('Cancellation quantity must be a positive integer');
            }
            const line = lineById.get(update.orderLineId);
            if (line === undefined) {
                throw new NotFoundError('Order line was not found on this order', {
                    orderId: input.orderId,
                    orderLineId: update.orderLineId,
                });
            }
            const cancellable = orderLineCancellableQuantity(line);
            if (update.quantity > cancellable) {
                throw new BusinessRuleError('Cancellation quantity exceeds cancellable quantity', {
                    orderLineId: line.id,
                    cancellable,
                    requested: update.quantity,
                });
            }
            const cancelledQuantity = line.cancelledQuantity + update.quantity;
            const status = cancelledQuantity === line.quantity ? OrderLineStatus.CANCELLED : line.status;
            const updatedLine = withOrderLineUpdatedQuantities(line, {
                cancelledQuantity,
                status,
                updatedAt: now,
            });
            await deps.orders.updateOrderLine(transaction, updatedLine);
            lineById.set(line.id, updatedLine);
            appliedLines.push({
                orderLineId: line.id,
                productId: line.productId,
                stockLocationId: line.stockLocationId,
                quantity: update.quantity,
            });
        }
        const allLines = lockedLines.map((line) => lineById.get(line.id) ?? line);
        const fullyCancelled = allLines.every((line) => line.cancelledQuantity === line.quantity);
        const previousOrderStatus = order.status;
        let updatedOrder = order;
        if (fullyCancelled) {
            updatedOrder = transitionOrderEntity(order, OrderStatus.CANCELLED, now);
            await deps.orders.updateOrder(transaction, updatedOrder);
            const orderDto = toOrderDto(updatedOrder);
            await deps.eventRecorder.record(transaction, orderStatusChangedEvent(orderDto, previousOrderStatus));
            await deps.eventRecorder.record(transaction, orderCancelledEvent(orderDto));
        }
        return {
            order: toOrderDto(updatedOrder),
            appliedLines,
            previousOrderStatus,
        };
    }

    async function lockOrderLinesForFulfillment(tenantId, orderId, tx) {
        const order = await deps.orders.lockOrderForUpdate(tx, tenantId, orderId);
        if (order === null) {
            throw new NotFoundError('Order was not found', { tenantId, orderId });
        }
        if (order.status === OrderStatus.CANCELLED) {
            throw new BusinessRuleError('Cannot fulfill a cancelled order', {
                orderId,
                status: order.status,
            });
        }
        if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.RETURNED) {
            throw new BusinessRuleError('Order is not open for shipment', {
                orderId,
                status: order.status,
            });
        }
        return deps.orders.lockOrderLinesForUpdate(tx, tenantId, orderId);
    }

    async function applyShipmentQuantities(tenantId, orderId, lines, tx) {
        if (lines.length === 0) {
            throw new ValidationError('At least one shipment line is required');
        }
        const locked = await lockOrderLinesForFulfillment(tenantId, orderId, tx);
        const byId = new Map(locked.map((line) => [line.id, line]));
        for (const input of lines) {
            if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
                throw new ValidationError('Shipment line quantity must be a positive integer');
            }
            const line = byId.get(input.orderLineId);
            if (line === undefined) {
                throw new NotFoundError('Order line was not found on this order', {
                    tenantId,
                    orderId,
                    orderLineId: input.orderLineId,
                });
            }
            const shippable = orderLineShippableQuantity(line);
            if (input.quantity > shippable) {
                throw new BusinessRuleError('Shipment quantity exceeds shippable quantity', {
                    orderLineId: input.orderLineId,
                    requestedQuantity: input.quantity,
                    shippableQuantity: shippable,
                });
            }
            const shippedQuantity = line.shippedQuantity + input.quantity;
            const updated = withOrderLineUpdatedQuantities(line, {
                shippedQuantity,
                status: shippedQuantity >= line.quantity - line.cancelledQuantity
                    ? OrderLineStatus.CLOSED
                    : line.status,
            });
            await deps.orders.updateOrderLine(tx, updated);
            byId.set(input.orderLineId, updated);
        }
    }

    async function reverseShipmentQuantities(tenantId, orderId, lines, tx) {
        const locked = await lockOrderLinesForFulfillment(tenantId, orderId, tx);
        const byId = new Map(locked.map((line) => [line.id, line]));
        for (const input of lines) {
            if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
                throw new ValidationError('Shipment line quantity must be a positive integer');
            }
            const line = byId.get(input.orderLineId);
            if (line === undefined) {
                throw new NotFoundError('Order line was not found on this order', {
                    tenantId,
                    orderId,
                    orderLineId: input.orderLineId,
                });
            }
            if (input.quantity > line.shippedQuantity) {
                throw new BusinessRuleError('Cannot reverse more than shipped quantity', {
                    orderLineId: input.orderLineId,
                    requestedQuantity: input.quantity,
                    shippedQuantity: line.shippedQuantity,
                });
            }
            const shippedQuantity = line.shippedQuantity - input.quantity;
            const updated = withOrderLineUpdatedQuantities(line, {
                shippedQuantity,
                status: shippedQuantity < line.quantity - line.cancelledQuantity
                    ? OrderLineStatus.OPEN
                    : line.status,
            });
            await deps.orders.updateOrderLine(tx, updated);
            byId.set(input.orderLineId, updated);
        }
    }

    async function evaluateOrderShipmentState(tenantId, orderId, tx) {
        const order = await deps.orders.findById(tx, tenantId, orderId);
        if (order === null) {
            throw new NotFoundError('Order was not found', { tenantId, orderId });
        }
        const lines = await deps.orders.listOrderLines(tx, tenantId, orderId);
        const allNonCancelledShipped = lines.every((line) => line.shippedQuantity >= line.quantity - line.cancelledQuantity);
        if (!allNonCancelledShipped) {
            return;
        }
        let updated = order;
        const previousStatus = order.status;
        if (updated.status === OrderStatus.CONFIRMED) {
            updated = transitionOrderEntity(updated, OrderStatus.PROCESSING);
        }
        if (updated.status === OrderStatus.PROCESSING) {
            updated = transitionOrderEntity(updated, OrderStatus.READY_TO_SHIP);
        }
        if (updated.status === OrderStatus.READY_TO_SHIP) {
            updated = transitionOrderEntity(updated, OrderStatus.SHIPPED);
        }
        if (updated.status === previousStatus) {
            return;
        }
        await deps.orders.updateOrder(tx, updated);
        await deps.eventRecorder.record(tx, orderStatusChangedEvent(toOrderDto(updated), previousStatus));
    }

    return {
        applyCancellation,
        lockOrderLinesForFulfillment,
        applyShipmentQuantities,
        reverseShipmentQuantities,
        evaluateOrderShipmentState,
    };
}
