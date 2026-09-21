import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { ReturnStatus } from '../domain/return-status.js';
import { toReturnDetailDto } from './return-dto.js';
import { returnStatusChangedEvent } from './return-events.js';
import { requireReturnsUpdate } from './return-permissions.js';
const RETURN_REFERENCE_TYPE = 'RETURN';
export class ReceiveReturn {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireReturnsUpdate(this.deps.authorization, input.actorPermissions);
        const returnDetail = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.returns.lockForUpdate(tx, input.tenantId, input.returnId);
            if (existing === null) {
                throw new NotFoundError('Return was not found', {
                    tenantId: input.tenantId,
                    returnId: input.returnId,
                });
            }
            const lines = await this.deps.returns.listReturnLines(tx, input.tenantId, input.returnId);
            if (existing.status === ReturnStatus.RECEIVED ||
                existing.status === ReturnStatus.COMPLETED) {
                return toReturnDetailDto(existing, lines);
            }
            if (existing.status !== ReturnStatus.APPROVED) {
                throw new BusinessRuleError('Return must be approved before it can be received', {
                    returnId: input.returnId,
                    status: existing.status,
                });
            }
            const orderLines = await this.deps.orders.lockOrderLinesForUpdate(tx, input.tenantId, existing.orderId);
            const orderLineById = new Map(orderLines.map((line) => [line.id, line]));
            const now = new Date();
            for (const returnLine of lines) {
                const orderLine = orderLineById.get(returnLine.orderLineId);
                if (orderLine === undefined) {
                    throw new NotFoundError('Order line was not found for return line', {
                        returnId: input.returnId,
                        orderLineId: returnLine.orderLineId,
                    });
                }
                const eligibleQuantity = orderLine.shippedQuantity - orderLine.returnedQuantity;
                if (returnLine.quantity > eligibleQuantity) {
                    throw new BusinessRuleError('Return quantity exceeds eligible amount for order line', {
                        orderLineId: returnLine.orderLineId,
                        requestedQuantity: returnLine.quantity,
                        eligibleQuantity,
                    });
                }
                await this.deps.inventoryService.recordReturn({
                    tenantId: input.tenantId,
                    stockLocationId: orderLine.stockLocationId,
                    productId: orderLine.productId,
                    quantity: returnLine.quantity,
                    referenceType: RETURN_REFERENCE_TYPE,
                    referenceId: input.returnId,
                    idempotencyKey: returnLine.id,
                }, tx);
                const newReturnedQuantity = orderLine.returnedQuantity + returnLine.quantity;
                await this.deps.orders.updateOrderLineReturnedQuantity(tx, input.tenantId, orderLine.id, newReturnedQuantity, now);
            }
            const previousStatus = existing.status;
            const updated = existing.receive(now);
            await this.deps.returns.updateReturn(tx, updated);
            const detail = toReturnDetailDto(updated, lines);
            if (previousStatus !== updated.status) {
                await this.deps.eventRecorder.record(tx, returnStatusChangedEvent(detail, previousStatus));
                await this.deps.auditRecorder?.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: input.actorKind,
                    actorId: input.actorId,
                    eventType: 'RETURN_RECEIVED',
                    resourceType: 'return',
                    resourceId: updated.id,
                    metadata: {
                        orderId: updated.orderId,
                        previousStatus,
                        newStatus: updated.status,
                        lineCount: lines.length,
                    },
                    ...auditRequestFields(),
                });
            }
            return detail;
        }, { tenantId: input.tenantId });
        return { return: returnDetail };
    }
}
