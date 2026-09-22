import { BusinessRuleError } from '../../../shared/errors/index.js';
export const ReturnStatus = {
    REQUESTED: 'REQUESTED',
    APPROVED: 'APPROVED',
    RECEIVED: 'RECEIVED',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
};
const LEGAL_TRANSITIONS = {
    [ReturnStatus.REQUESTED]: [ReturnStatus.APPROVED, ReturnStatus.REJECTED, ReturnStatus.CANCELLED],
    [ReturnStatus.APPROVED]: [ReturnStatus.RECEIVED, ReturnStatus.REJECTED, ReturnStatus.CANCELLED],
    [ReturnStatus.RECEIVED]: [ReturnStatus.COMPLETED],
    [ReturnStatus.COMPLETED]: [],
    [ReturnStatus.REJECTED]: [],
    [ReturnStatus.CANCELLED]: [],
};
export function canTransitionReturnStatus(from, to) {
    if (from === to) {
        return true;
    }
    return LEGAL_TRANSITIONS[from].includes(to);
}
export function assertReturnTransition(from, to) {
    if (!canTransitionReturnStatus(from, to)) {
        throw new BusinessRuleError(`Invalid return status transition from ${from} to ${to}`, {
            from,
            to,
        });
    }
}
export function isReturnTerminal(status) {
    return (status === ReturnStatus.COMPLETED ||
        status === ReturnStatus.REJECTED ||
        status === ReturnStatus.CANCELLED);
}
export const PENDING_RETURN_STATUSES = [
    ReturnStatus.REQUESTED,
    ReturnStatus.APPROVED,
];
