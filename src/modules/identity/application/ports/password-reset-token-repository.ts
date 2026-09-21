import type { Transaction } from '../../../../shared/persistence/index.js';

export type PasswordResetTokenStatus = 'ACTIVE' | 'USED' | 'REVOKED';

export interface PasswordResetTokenRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly status: PasswordResetTokenStatus;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly usedAt: Date | null;
}

export interface PasswordResetTokenRepository {
  save(tx: Transaction, token: PasswordResetTokenRecord): Promise<void>;
  findActiveByTokenHash(
    tx: Transaction,
    tokenHash: string,
  ): Promise<PasswordResetTokenRecord | null>;
  markUsed(tx: Transaction, id: string, usedAt: Date): Promise<void>;
  revokeActiveForUser(tx: Transaction, userId: string): Promise<void>;
}
