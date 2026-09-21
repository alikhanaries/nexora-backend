import type { Transaction } from '../../../../shared/persistence/index.js';
import type { MfaFactor, MfaFactorStatus } from '../../domain/mfa-factor.js';

export interface CreateMfaFactorRecord {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly secretEncrypted: string;
  readonly label: string;
}

export interface MfaFactorRepository {
  createPending(tx: Transaction, record: CreateMfaFactorRecord): Promise<MfaFactor>;
  findById(tx: Transaction, id: string): Promise<MfaFactor | null>;
  findActiveByUser(tx: Transaction, userId: string, tenantId: string): Promise<MfaFactor | null>;
  activate(tx: Transaction, id: string, activatedAt: Date): Promise<void>;
  revokeAllForUser(
    tx: Transaction,
    userId: string,
    tenantId: string,
    revokedAt: Date,
  ): Promise<void>;
  updateStatus(tx: Transaction, id: string, status: MfaFactorStatus): Promise<void>;
}
