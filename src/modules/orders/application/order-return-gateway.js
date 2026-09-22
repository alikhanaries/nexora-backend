import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { toOrderDto } from './order-dto.js';

export class DefaultOrderReturnGateway {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async findOrder(queryable, tenantId, orderId) {
        const order = await this.deps.orders.findById(queryable, tenantId, orderId);
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
    async lockOrderLinesForUpdate(transaction, tenantId, orderId) {
        const lines = await this.deps.orders.lockOrderLinesForUpdate(transaction, tenantId, orderId);
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
    async updateOrderLineReturnedQuantity(transaction, tenantId, orderLineId, returnedQuantity, updatedAt) {
        await this.deps.orders.updateOrderLineReturnedQuantity(transaction, tenantId, orderLineId, returnedQuantity, updatedAt);
    }
    async applyReturnReceivedOnOrderLine(transaction, tenantId, orderLineId, quantity, updatedAt) {
        const line = await this.deps.orders.lockOrderLineForUpdate(transaction, tenantId, orderLineId);
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
        await this.deps.orders.updateOrderLine(transaction, updated);
    }
}
