import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import { ReturnStatus } from '../domain/return-status.js';
import { toReturnDetailDto } from './return-dto.js';
import { returnStatusChangedEvent } from './return-events.js';
import { requireReturnsUpdate } from './return-permissions.js';

export class AcknowledgeReturn {
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
            const updated = existing.approve(now);
            await this.deps.returns.updateReturn(tx, updated);
            const detail = toReturnDetailDto(updated, lines);
            if (previousStatus !== updated.status) {
                await this.deps.eventRecorder.record(tx, returnStatusChangedEvent(detail, previousStatus));
                await this.deps.auditRecorder?.record(tx, {
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
            : await this.deps.database.execute(work, { tenantId: input.tenantId });
        return { return: returnDetail };
    }
}
