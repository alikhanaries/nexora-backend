import { auditRequestFields } from '../../audit/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import {
    approveReturnEntity,
    cancelReturnEntity,
    completeReturnEntity,
    rejectReturnEntity,
} from '../models/return.js';
import { ReturnStatus } from '../models/return-status.js';
import { toReturnDetailDto } from '../views/return-dto.js';
import { returnStatusChangedEvent } from './return-events.js';
import { requireReturnsUpdate } from './return-permissions.js';

/**
 * @param {object} deps
 * @param {object} input
 * @param {(returnEntity: import('../models/return.js').Return, at: Date) => import('../models/return.js').Return} transition
 * @param {string} auditEventType
 */
async function transitionReturn(deps, input, transition, auditEventType) {
    requireReturnsUpdate(deps.authorization, input.actorPermissions);
    const returnDetail = await deps.database.execute(async (tx) => {
        const existing = await deps.returns.lockForUpdate(tx, input.tenantId, input.returnId);
        if (existing === null) {
            throw new NotFoundError('Return was not found', {
                tenantId: input.tenantId,
                returnId: input.returnId,
            });
        }
        const previousStatus = existing.status;
        const now = new Date();
        const updated = transition(existing, now);
        await deps.returns.updateReturn(tx, updated);
        const lines = await deps.returns.listReturnLines(tx, input.tenantId, input.returnId);
        const detail = toReturnDetailDto(updated, lines);
        if (previousStatus !== updated.status) {
            await deps.eventRecorder.record(tx, returnStatusChangedEvent(detail, previousStatus));
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: auditEventType,
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
    }, { tenantId: input.tenantId });
    return { return: returnDetail };
}

/**
 * Shared private helper for approve/reject/cancel transitions.
 * @param {object} deps
 * @param {(returnEntity: import('../models/return.js').Return, at: Date) => import('../models/return.js').Return} transition
 * @param {string} auditEventType
 * @returns {{ execute: Function }}
 */
function createTransitionReturn(deps, transition, auditEventType) {
    function execute(input) {
        return transitionReturn(deps, input, transition, auditEventType);
    }
    return { execute };
}

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createApproveReturn(deps) {
    return createTransitionReturn(
        deps,
        (returnEntity, at) => approveReturnEntity(returnEntity, at),
        'RETURN_APPROVED',
    );
}

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createRejectReturn(deps) {
    return createTransitionReturn(
        deps,
        (returnEntity, at) => rejectReturnEntity(returnEntity, at),
        'RETURN_REJECTED',
    );
}

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createCancelReturn(deps) {
    return createTransitionReturn(
        deps,
        (returnEntity, at) => cancelReturnEntity(returnEntity, at),
        'RETURN_CANCELLED',
    );
}

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createCompleteReturn(deps) {
    async function execute(input) {
        requireReturnsUpdate(deps.authorization, input.actorPermissions);
        const returnDetail = await deps.database.execute(async (tx) => {
            const existing = await deps.returns.lockForUpdate(tx, input.tenantId, input.returnId);
            if (existing === null) {
                throw new NotFoundError('Return was not found', {
                    tenantId: input.tenantId,
                    returnId: input.returnId,
                });
            }
            if (existing.status !== ReturnStatus.RECEIVED) {
                throw new BusinessRuleError('Return must be received before it can be completed', {
                    returnId: input.returnId,
                    status: existing.status,
                });
            }
            const previousStatus = existing.status;
            const now = new Date();
            const updated = completeReturnEntity(existing, now);
            await deps.returns.updateReturn(tx, updated);
            const lines = await deps.returns.listReturnLines(tx, input.tenantId, input.returnId);
            const detail = toReturnDetailDto(updated, lines);
            await deps.eventRecorder.record(tx, returnStatusChangedEvent(detail, previousStatus));
            await deps.auditRecorder?.record(tx, {
                tenantId: input.tenantId,
                actorKind: input.actorKind,
                actorId: input.actorId,
                eventType: 'RETURN_COMPLETED',
                resourceType: 'return',
                resourceId: updated.id,
                metadata: {
                    orderId: updated.orderId,
                    previousStatus,
                    newStatus: updated.status,
                },
                ...auditRequestFields(),
            });
            return detail;
        }, { tenantId: input.tenantId });
        return { return: returnDetail };
    }

    return { execute };
}
