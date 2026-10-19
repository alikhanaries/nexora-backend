import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { toOrderDto } from '../views/order-dto.js';

/**
 * @param {object} deps
 * @param {import('../repositories/postgres-order-repository.js').PostgresOrderRepository} deps.orders
 */
export function createOrderReturnGateway(deps) {
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

    async function updateOrderLineReturnedQuantity(transaction, tenantId, orderLineId, returnedQuantity, updatedAt) {
        await deps.orders.updateOrderLineReturnedQuantity(transaction, tenantId, orderLineId, returnedQuantity, updatedAt);
    }

    async function applyReturnReceivedOnOrderLine(transaction, tenantId, orderLineId, quantity, updatedAt) {
        const line = await deps.orders.lockOrderLineForUpdate(transaction, tenantId, orderLineId);
        if (line === null) {
            throw new NotFoundError('Order line was not found', { tenantId, orderLineId });
        }
        const eligibleQuantity = line.returnableQuantity();
        if (quantity > eligibleQuantity) {
            throw new BusinessRuleError('Return quantity exceeds eligible amount for order line', {
                orderLineId,
                requestedQuantity: quantity,
                eligibleQuantity,
            });
        }
        const updated = line.withUpdatedQuantities({
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

/** @deprecated Prefer {@link createOrderReturnGateway}; kept for existing import sites. */
export class DefaultOrderReturnGateway {
    constructor(deps) {
        return createOrderReturnGateway(deps);
    }
}
