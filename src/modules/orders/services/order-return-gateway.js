import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { orderLineReturnableQuantity, withOrderLineUpdatedQuantities } from '../models/order-line.js';
import { toOrderDto } from '../views/order-dto.js';

/**
 * @param {object} deps
 * @param {ReturnType<import('../repositories/postgres-order-repository.js').createPostgresOrderRepository>} deps.orders
 */
export function createOrderReturnGateway(deps) {
    /**
     * Thin delegate to order repository for returns module (tenant-scoped line updates).
     */
    async function findOrder(queryable, tenantId, orderId) {
        const order = await deps.orders.findById(queryable, tenantId, orderId);
        if (order === null) {
            return null;
        }
        const dto = toOrderDto(order);
        return {
            id: dto.id,
            tenantId: dto.tenantId,
            status: dto.status,
        };
    }

    /**
     * Line-level FOR UPDATE locks for shipment/cancel/return commands.
     */
    async function lockOrderLinesForUpdate(transaction, tenantId, orderId) {
        const lines = await deps.orders.lockOrderLinesForUpdate(transaction, tenantId, orderId);
        return lines.map((line) => ({
            id: line.id,
            tenantId: line.tenantId,
            orderId: line.orderId,
            productId: line.productId,
            stockLocationId: line.stockLocationId,
            merchantSku: line.merchantSku,
            shippedQuantity: line.shippedQuantity,
            returnedQuantity: line.returnedQuantity,
        }));
    }

    /**
     * Increments returned qty on a line (returns module gateway).
     */
    async function updateOrderLineReturnedQuantity(transaction, tenantId, orderLineId, returnedQuantity, updatedAt) {
        await deps.orders.updateOrderLineReturnedQuantity(transaction, tenantId, orderLineId, returnedQuantity, updatedAt);
    }

    /**
     * Thin delegate to order repository for returns module (tenant-scoped line updates).
     */
    async function applyReturnReceivedOnOrderLine(transaction, tenantId, orderLineId, quantity, updatedAt) {
        const line = await deps.orders.lockOrderLineForUpdate(transaction, tenantId, orderLineId);
        if (line === null) {
            throw new NotFoundError('Order line was not found', { tenantId, orderLineId });
        }
        const eligibleQuantity = orderLineReturnableQuantity(line);
        if (quantity > eligibleQuantity) {
            throw new BusinessRuleError('Return quantity exceeds eligible amount for order line', {
                orderLineId,
                requestedQuantity: quantity,
                eligibleQuantity,
            });
        }
        const updated = withOrderLineUpdatedQuantities(line, {
            shippedQuantity: line.shippedQuantity - quantity,
            returnedQuantity: line.returnedQuantity + quantity,
            updatedAt,
        });
        await deps.orders.updateOrderLine(transaction, updated);
    }

    return {
        findOrder,
        lockOrderLinesForUpdate,
        updateOrderLineReturnedQuantity,
        applyReturnReceivedOnOrderLine,
    };
}
