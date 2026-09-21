import type { Transaction } from '../../../../shared/persistence/index.js';

export interface RecoveryCodeRepository {
  createBatch(
    tx: Transaction,
    input: {
      readonly userId: string;
      readonly tenantId: string;
      readonly codeHashes: readonly string[];
    },
  ): Promise<void>;
  findActiveByHash(
    tx: Transaction,
    codeHash: string,
  ): Promise<{ id: string; userId: string; tenantId: string } | null>;
  markUsed(tx: Transaction, id: string, usedAt: Date): Promise<void>;
  revokeAllForUser(tx: Transaction, userId: string, tenantId: string): Promise<void>;
}
