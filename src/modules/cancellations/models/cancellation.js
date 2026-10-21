import { BusinessRuleError } from '../../../shared/errors/index.js';
import { CancellationStatus } from './cancellation-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   orderId: string,
 *   externalReference: string | null,
 *   status: string,
 *   reason: string | null,
 *   createdAt: Date,
 *   updatedAt: Date,
 *   completedAt: Date | null,
 * }} Cancellation
 */

/**
 * @param {Omit<Cancellation, 'status' | 'completedAt' | 'updatedAt'> & {
 *   status?: string,
 *   completedAt?: Date | null,
 *   updatedAt?: Date,
 * }} props
 * @returns {Cancellation}
 */
export function createCancellationEntity(props) {
    const now = props.createdAt ?? new Date();
    return {
        id: props.id,
        tenantId: props.tenantId,
        orderId: props.orderId,
        externalReference: props.externalReference ?? null,
        status: props.status ?? CancellationStatus.REQUESTED,
        reason: props.reason,
        createdAt: now,
        updatedAt: props.updatedAt ?? now,
        completedAt: props.completedAt ?? null,
    };
}

/**
 * @param {Cancellation} props
 * @returns {Cancellation}
 */
export function reconstituteCancellation(props) {
    return { ...props };
}

/**
 * @param {Cancellation} cancellation
 * @param {Date} [at]
 * @returns {Cancellation}
 */
export function completeCancellationEntity(cancellation, at = new Date()) {
    if (cancellation.status !== CancellationStatus.REQUESTED) {
        throw new BusinessRuleError('Only requested cancellations can be completed', {
            cancellationId: cancellation.id,
            status: cancellation.status,
        });
    }
    return {
        ...cancellation,
        status: CancellationStatus.COMPLETED,
        completedAt: at,
        updatedAt: at,
    };
}

/**
 * @param {Cancellation} cancellation
 * @param {Date} [at]
 * @returns {Cancellation}
 */
export function rejectCancellationEntity(cancellation, at = new Date()) {
    if (cancellation.status !== CancellationStatus.REQUESTED) {
        throw new BusinessRuleError('Only requested cancellations can be rejected', {
            cancellationId: cancellation.id,
            status: cancellation.status,
        });
    }
    return {
        ...cancellation,
        status: CancellationStatus.REJECTED,
        updatedAt: at,
    };
}
