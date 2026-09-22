import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { ReturnStatus } from '../domain/return-status.js';
import { toReturnDetailDto } from './return-dto.js';
import { returnStatusChangedEvent } from './return-events.js';
import { requireReturnsUpdate } from './return-permissions.js';

const RETURN_REFERENCE_TYPE = 'RETURN';

export class ProcessReturnReceive {
    deps;

    constructor(deps) {
        this.deps = deps;
    }

    async execute(input) {
        requireReturnsUpdate(this.deps.authorization, input.actorPermissions);
        const work = async (tx) => {
            const existing = await this.deps.returns.lockForUpdate(tx, input.tenantId, input.returnId);
            if (existing === null) {
                throw new NotFoundError('Return was not found', {
                    tenantId: input.tenantId,
                    returnId: input.returnId,
                });
            }
            const lines = await this.deps.returns.listReturnLines(tx, input.tenantId, input.returnId);
            const orderLines = await this.deps.orders.lockOrderLinesForUpdate(tx, input.tenantId, existing.orderId);
            const orderLineById = new Map(orderLines.map((line) => [line.id, line]));
            validateLineDecisions(input.lineDecisions, lines, orderLineById);

            if (existing.status === ReturnStatus.RECEIVED || existing.status === ReturnStatus.COMPLETED) {
                return toReturnDetailDto(existing, lines);
            }
            if (existing.status === ReturnStatus.REJECTED || existing.status === ReturnStatus.CANCELLED) {
                throw new BusinessRuleError('Return was already handled', {
                    returnId: input.returnId,
                    status: existing.status,
                });
            }

            const decision = summarizeDecision(input.lineDecisions);
            if (decision === 'reject') {
                return this.rejectReturn(tx, input, existing, lines);
            }
            if (decision === 'accept') {
                return this.acceptReturn(tx, input, existing, lines, orderLineById);
            }
            throw new BusinessRuleError('Partial accept/reject per line is not supported', {
                returnId: input.returnId,
            });
        };
        const returnDetail = input.transaction !== undefined
            ? await work(input.transaction)
            : await this.deps.database.execute(work, { tenantId: input.tenantId });
        return { return: returnDetail };
    }

    /**
     * @param {object} tx
     * @param {object} input
     * @param {import('../domain/return.js').Return} existing
     * @param {import('../domain/return-line.js').ReturnLine[]} lines
     */
    async rejectReturn(tx, input, existing, lines) {
        const now = new Date();
        if (existing.status === ReturnStatus.REJECTED) {
            return toReturnDetailDto(existing, lines);
        }
        const previousStatus = existing.status;
        const updated = existing.reject(now);
        await this.deps.returns.updateReturn(tx, updated);
        const detail = toReturnDetailDto(updated, lines);
        if (previousStatus !== updated.status) {
            await this.deps.eventRecorder.record(tx, returnStatusChangedEvent(detail, previousStatus));
            await this.deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'RETURN_REJECTED',
                resourceType: 'return',
                resourceId: updated.id,
                metadata: {
                    orderId: updated.orderId,
                    previousStatus,
                    newStatus: updated.status,
                },
                ...auditRequestFields(),
            });
        }
        return detail;
    }

    /**
     * @param {object} tx
     * @param {object} input
     * @param {import('../domain/return.js').Return} existing
     * @param {import('../domain/return-line.js').ReturnLine[]} lines
     * @param {Map<string, object>} orderLineById
     */
    async acceptReturn(tx, input, existing, lines, orderLineById) {
        let updated = existing;
        const now = new Date();
        if (updated.status === ReturnStatus.REQUESTED) {
            const previousStatus = updated.status;
            updated = updated.approve(now);
            await this.deps.returns.updateReturn(tx, updated);
            const approvedDetail = toReturnDetailDto(updated, lines);
            await this.deps.eventRecorder.record(tx, returnStatusChangedEvent(approvedDetail, previousStatus));
        }
        if (updated.status !== ReturnStatus.APPROVED) {
            throw new BusinessRuleError('Return must be approved before it can be received', {
                returnId: input.returnId,
                status: updated.status,
            });
        }
        for (const returnLine of lines) {
            const orderLine = orderLineById.get(returnLine.orderLineId);
            if (orderLine === undefined) {
                throw new NotFoundError('Order line was not found for return line', {
                    returnId: input.returnId,
                    orderLineId: returnLine.orderLineId,
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
            await this.deps.orders.applyReturnReceivedOnOrderLine(
                tx,
                input.tenantId,
                orderLine.id,
                returnLine.quantity,
                now,
            );
        }
        const previousStatus = updated.status;
        updated = updated.receive(now);
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
    }
}

/**
 * @param {Array<{ merchantProductNo: string, acceptedQuantity: number, rejectedQuantity: number }>} lineDecisions
 * @param {import('../domain/return-line.js').ReturnLine[]} returnLines
 * @param {Map<string, { id: string, merchantSku: string, quantity: number }>} orderLineById
 */
function validateLineDecisions(lineDecisions, returnLines, orderLineById) {
    if (lineDecisions.length === 0) {
        throw new ValidationError('At least one return line decision is required');
    }
    /** @type {Map<string, { acceptedQuantity: number, rejectedQuantity: number }>} */
    const bySku = new Map();
    for (const line of lineDecisions) {
        if (!Number.isInteger(line.acceptedQuantity) || line.acceptedQuantity < 0) {
            throw new ValidationError('AcceptedQuantity must be a non-negative integer');
        }
        if (!Number.isInteger(line.rejectedQuantity) || line.rejectedQuantity < 0) {
            throw new ValidationError('RejectedQuantity must be a non-negative integer');
        }
        if (line.acceptedQuantity > 0 && line.rejectedQuantity > 0) {
            throw new BusinessRuleError('A return line cannot be both accepted and rejected', {
                merchantProductNo: line.merchantProductNo,
            });
        }
        const sku = line.merchantProductNo.trim();
        if (sku.length === 0) {
            throw new ValidationError('MerchantProductNo is required');
        }
        const existing = bySku.get(sku) ?? { acceptedQuantity: 0, rejectedQuantity: 0 };
        bySku.set(sku, {
            acceptedQuantity: existing.acceptedQuantity + line.acceptedQuantity,
            rejectedQuantity: existing.rejectedQuantity + line.rejectedQuantity,
        });
    }

    /** @type {Map<string, number>} */
    const returnQtyBySku = new Map();
    for (const returnLine of returnLines) {
        const orderLine = orderLineById.get(returnLine.orderLineId);
        if (orderLine === undefined) {
            throw new NotFoundError('Order line was not found for return line', {
                orderLineId: returnLine.orderLineId,
            });
        }
        const sku = orderLine.merchantSku;
        returnQtyBySku.set(sku, (returnQtyBySku.get(sku) ?? 0) + returnLine.quantity);
    }

    if (bySku.size !== returnQtyBySku.size) {
        throw new ConflictError('Return line decisions do not match the return', {
            requestedSkus: [...bySku.keys()],
            returnSkus: [...returnQtyBySku.keys()],
        });
    }
    for (const [sku, returnQuantity] of returnQtyBySku) {
        const decision = bySku.get(sku);
        if (decision === undefined) {
            throw new NotFoundError('Return line decision was not found for merchant product number', {
                merchantProductNo: sku,
            });
        }
        const decidedQuantity = decision.acceptedQuantity + decision.rejectedQuantity;
        if (decidedQuantity !== returnQuantity) {
            throw new BusinessRuleError('Accepted and rejected quantities must match the return line quantity', {
                merchantProductNo: sku,
                returnQuantity,
                decidedQuantity,
            });
        }
    }
}

/**
 * @param {Array<{ acceptedQuantity: number, rejectedQuantity: number }>} lineDecisions
 * @returns {'accept'|'reject'|'partial'}
 */
function summarizeDecision(lineDecisions) {
    const hasAccepted = lineDecisions.some((line) => line.acceptedQuantity > 0);
    const hasRejected = lineDecisions.some((line) => line.rejectedQuantity > 0);
    if (hasAccepted && hasRejected) {
        return 'partial';
    }
    if (hasRejected) {
        return 'reject';
    }
    if (hasAccepted) {
        return 'accept';
    }
    throw new ValidationError('At least one accepted or rejected quantity is required');
}
