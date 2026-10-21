import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { ReturnStatus } from '../models/return-status.js';
import { approveReturnEntity } from '../models/return.js';
import { toReturnDetailDto } from '../views/return-dto.js';
import { returnStatusChangedEvent } from './return-events.js';
import { requireReturnsUpdate } from './return-permissions.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createAcknowledgeReturn(deps) {
/** Application workflow entry for this command/query (tenant-scoped, permission-checked). */
    async function execute(input) {
        requireReturnsUpdate(deps.authorization, input.actorPermissions);
/** Transactional unit of work executed inside idempotency/database `execute`. */
        const work = async (tx) => {
            const existing = await deps.returns.lockForUpdate(tx, input.tenantId, input.returnId);
            if (existing === null) {
                throw new NotFoundError('Return was not found', {
                    tenantId: input.tenantId,
                    returnId: input.returnId,
                });
            }
            const lines = await deps.returns.listReturnLines(tx, input.tenantId, input.returnId);
            if (existing.status === ReturnStatus.APPROVED
                || existing.status === ReturnStatus.RECEIVED
                || existing.status === ReturnStatus.COMPLETED) {
                return toReturnDetailDto(existing, lines);
            }
            if (existing.status !== ReturnStatus.REQUESTED) {
                throw new BusinessRuleError('Return cannot be acknowledged in its current status', {
                    returnId: input.returnId,
                    status: existing.status,
                });
            }
            const previousStatus = existing.status;
            const now = new Date();
            const updated = approveReturnEntity(existing, now);
            await deps.returns.updateReturn(tx, updated);
            const detail = toReturnDetailDto(updated, lines);
            if (previousStatus !== updated.status) {
                await deps.eventRecorder.record(tx, returnStatusChangedEvent(detail, previousStatus));
                await deps.auditRecorder?.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: input.actorKind,
                    actorId: input.actorId,
                    eventType: 'RETURN_ACKNOWLEDGED',
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
        };
        const returnDetail = input.transaction !== undefined
            ? await work(input.transaction)
            : await deps.database.execute(work, { tenantId: input.tenantId });
        return { return: returnDetail };
    }

    return { execute };
}
