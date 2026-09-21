import type { Transaction } from '../../../../shared/persistence/index.js';

export interface StepUpSessionRepository {
  upsert(
    tx: Transaction,
    input: {
      readonly id: string;
      readonly userId: string;
      readonly tenantId: string;
      readonly sessionId: string;
      readonly verifiedAt: Date;
      readonly expiresAt: Date;
    },
  ): Promise<void>;
  findValid(
    tx: Transaction,
    input: {
      readonly userId: string;
      readonly tenantId: string;
      readonly sessionId: string;
      readonly now: Date;
    },
  ): Promise<boolean>;
}
