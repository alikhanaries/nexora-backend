import type { Transaction } from '../../../../shared/persistence/index.js';
import type { ApiKey, ApiKeySummary, ApiKeyType } from '../../domain/api-key.js';

export interface CreateApiKeyRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly prefix: string;
  readonly secretHash: string;
  readonly keyType: ApiKeyType;
  readonly scopes: readonly string[];
  readonly expiresAt: Date | null;
  readonly rotatedFromId?: string | null;
}

export interface ApiKeyRepository {
  create(tx: Transaction, record: CreateApiKeyRecord): Promise<ApiKeySummary>;
  findByPrefix(tx: Transaction, prefix: string): Promise<ApiKey | null>;
  findById(tx: Transaction, id: string): Promise<ApiKey | null>;
  listByTenant(tx: Transaction, tenantId: string): Promise<readonly ApiKeySummary[]>;
  revoke(tx: Transaction, id: string, revokedAt: Date): Promise<void>;
  markRotated(tx: Transaction, id: string, revokedAt: Date): Promise<void>;
  touchLastUsed(tx: Transaction, id: string, usedAt: Date): Promise<void>;
}
