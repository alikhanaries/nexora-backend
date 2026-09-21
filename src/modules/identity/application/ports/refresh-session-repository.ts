import type { RefreshSession } from '../../domain/index.js';
import type { Transaction } from '../../../../shared/persistence/index.js';

export interface RefreshSessionRepository {
  findByTokenHash(tx: Transaction, tokenHash: string): Promise<RefreshSession | null>;
  findById(tx: Transaction, id: string): Promise<RefreshSession | null>;
  save(tx: Transaction, session: RefreshSession): Promise<void>;
  markReplaced(
    tx: Transaction,
    sessionId: string,
    replacedById: string,
    lastUsedAt: Date,
  ): Promise<void>;
  revokeFamily(tx: Transaction, familyId: string, revokedAt: Date): Promise<void>;
  revokeAllForUser(tx: Transaction, userId: string, revokedAt: Date): Promise<void>;
  revokeById(tx: Transaction, sessionId: string, revokedAt: Date): Promise<void>;
}
