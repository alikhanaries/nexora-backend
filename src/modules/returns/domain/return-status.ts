import { BusinessRuleError } from '../../../shared/errors/index.js';

export const ReturnStatus = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  RECEIVED: 'RECEIVED',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type ReturnStatus = (typeof ReturnStatus)[keyof typeof ReturnStatus];

const LEGAL_TRANSITIONS: Readonly<Record<ReturnStatus, readonly ReturnStatus[]>> = {
  [ReturnStatus.REQUESTED]: [ReturnStatus.APPROVED, ReturnStatus.REJECTED, ReturnStatus.CANCELLED],
  [ReturnStatus.APPROVED]: [ReturnStatus.RECEIVED, ReturnStatus.CANCELLED],
  [ReturnStatus.RECEIVED]: [ReturnStatus.COMPLETED],
  [ReturnStatus.COMPLETED]: [],
  [ReturnStatus.REJECTED]: [],
  [ReturnStatus.CANCELLED]: [],
};

export function canTransitionReturnStatus(from: ReturnStatus, to: ReturnStatus): boolean {
  if (from === to) {
    return true;
  }
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function assertReturnTransition(from: ReturnStatus, to: ReturnStatus): void {
  if (!canTransitionReturnStatus(from, to)) {
    throw new BusinessRuleError(`Invalid return status transition from ${from} to ${to}`, {
      from,
      to,
    });
  }
}

export function isReturnTerminal(status: ReturnStatus): boolean {
  return (
    status === ReturnStatus.COMPLETED ||
    status === ReturnStatus.REJECTED ||
    status === ReturnStatus.CANCELLED
  );
}

export const PENDING_RETURN_STATUSES: readonly ReturnStatus[] = [
  ReturnStatus.REQUESTED,
  ReturnStatus.APPROVED,
];
