import { BusinessRuleError } from '../../../shared/errors/index.js';
import { assertReturnTransition, ReturnStatus } from './return-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   orderId: string,
 *   externalReference: string | null,
 *   shipmentId: string | null,
 *   status: string,
 *   reason: string | null,
 *   createdAt: Date,
 *   updatedAt: Date,
 *   receivedAt: Date | null,
 *   completedAt: Date | null,
 * }} Return
 */

/**
 * @param {Omit<Return, 'status' | 'receivedAt' | 'completedAt' | 'updatedAt'> & {
 *   status?: string,
 *   receivedAt?: Date | null,
 *   completedAt?: Date | null,
 *   updatedAt?: Date,
 * }} props
 * @returns {Return}
 */
export function createReturnEntity(props) {
    const now = props.createdAt ?? new Date();
    return {
        id: props.id,
        tenantId: props.tenantId,
        orderId: props.orderId,
        externalReference: props.externalReference ?? null,
        shipmentId: props.shipmentId,
        status: props.status ?? ReturnStatus.REQUESTED,
        reason: props.reason,
        createdAt: now,
        updatedAt: props.updatedAt ?? now,
        receivedAt: props.receivedAt ?? null,
        completedAt: props.completedAt ?? null,
    };
}

/**
 * @param {Return} props
 * @returns {Return}
 */
export function reconstituteReturn(props) {
    return { ...props };
}

/**
 * @param {Return} returnEntity
 * @param {string} status
 * @param {Date} at
 * @returns {Return}
 */
function withReturnStatus(returnEntity, status, at) {
    if (returnEntity.status === status) {
        throw new BusinessRuleError('Return is already in the requested status', {
            returnId: returnEntity.id,
            status,
        });
    }
    return {
        ...returnEntity,
        status,
        updatedAt: at,
    };
}

/**
 * @param {Return} returnEntity
 * @param {Date} [at]
 * @returns {Return}
 */
export function approveReturnEntity(returnEntity, at = new Date()) {
    assertReturnTransition(returnEntity.status, ReturnStatus.APPROVED);
    return withReturnStatus(returnEntity, ReturnStatus.APPROVED, at);
}

/**
 * @param {Return} returnEntity
 * @param {Date} [at]
 * @returns {Return}
 */
export function receiveReturnEntity(returnEntity, at = new Date()) {
    if (returnEntity.status === ReturnStatus.RECEIVED) {
        return returnEntity;
    }
    assertReturnTransition(returnEntity.status, ReturnStatus.RECEIVED);
    return {
        ...returnEntity,
        status: ReturnStatus.RECEIVED,
        updatedAt: at,
        receivedAt: at,
    };
}

/**
 * @param {Return} returnEntity
 * @param {Date} [at]
 * @returns {Return}
 */
export function completeReturnEntity(returnEntity, at = new Date()) {
    assertReturnTransition(returnEntity.status, ReturnStatus.COMPLETED);
    return {
        ...returnEntity,
        status: ReturnStatus.COMPLETED,
        updatedAt: at,
        completedAt: at,
    };
}

/**
 * @param {Return} returnEntity
 * @param {Date} [at]
 * @returns {Return}
 */
export function rejectReturnEntity(returnEntity, at = new Date()) {
    assertReturnTransition(returnEntity.status, ReturnStatus.REJECTED);
    return withReturnStatus(returnEntity, ReturnStatus.REJECTED, at);
}

/**
 * @param {Return} returnEntity
 * @param {Date} [at]
 * @returns {Return}
 */
export function cancelReturnEntity(returnEntity, at = new Date()) {
    assertReturnTransition(returnEntity.status, ReturnStatus.CANCELLED);
    return withReturnStatus(returnEntity, ReturnStatus.CANCELLED, at);
}
