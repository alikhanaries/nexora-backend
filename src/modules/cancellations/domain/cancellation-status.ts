export const CancellationStatus = {
  REQUESTED: 'REQUESTED',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
} as const;

export type CancellationStatus = (typeof CancellationStatus)[keyof typeof CancellationStatus];
