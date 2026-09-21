import { z } from 'zod';
import type { Transaction } from '../../../shared/persistence/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import type {
  ApiKeyRepository,
  CreateApiKeyRecord,
} from '../application/ports/api-key-repository.js';
import type { ApiKey, ApiKeySummary } from '../domain/api-key.js';

const summaryRowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  key_type: z.enum(['STANDARD', 'INTEGRATION']),
  scopes: z.array(z.string()),
  status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED']),
  expires_at: z.coerce.date().nullable(),
  last_used_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

const fullRowSchema = summaryRowSchema.extend({
  secret_hash: z.string(),
  channel_id: z.string().uuid().nullable(),
  revoked_at: z.coerce.date().nullable(),
  rotated_from_id: z.string().uuid().nullable(),
});

function mapSummary(row: z.infer<typeof summaryRowSchema>): ApiKeySummary {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    prefix: row.prefix,
    keyType: row.key_type,
    scopes: row.scopes,
    status: row.status,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFull(row: z.infer<typeof fullRowSchema>): ApiKey {
  return {
    ...mapSummary(row),
    secretHash: row.secret_hash,
    channelId: row.channel_id,
    revokedAt: row.revoked_at,
    rotatedFromId: row.rotated_from_id,
  };
}

export class PostgresApiKeyRepository implements ApiKeyRepository {
  async create(tx: Transaction, record: CreateApiKeyRecord): Promise<ApiKeySummary> {
    const result = await tx.query(
      `INSERT INTO api_keys (
         id, tenant_id, name, prefix, secret_hash, key_type, scopes, expires_at, rotated_from_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, tenant_id, name, prefix, key_type, scopes, status,
                 expires_at, last_used_at, created_at, updated_at`,
      [
        record.id,
        record.tenantId,
        record.name,
        record.prefix,
        record.secretHash,
        record.keyType,
        [...record.scopes],
        record.expiresAt,
        record.rotatedFromId ?? null,
      ],
      { operation: 'api_keys.create' },
    );

    return mapSummary(parseOrThrow(summaryRowSchema, result.rows[0], 'api key row'));
  }

  async findByPrefix(tx: Transaction, prefix: string): Promise<ApiKey | null> {
    const result = await tx.query(
      `SELECT id, tenant_id, name, prefix, secret_hash, key_type, scopes, status,
              channel_id, expires_at, last_used_at, created_at, updated_at,
              revoked_at, rotated_from_id
       FROM api_keys WHERE prefix = $1`,
      [prefix],
      { operation: 'api_keys.find_by_prefix' },
    );
    if (result.rows.length === 0) return null;
    return mapFull(parseOrThrow(fullRowSchema, result.rows[0], 'api key row'));
  }

  async findById(tx: Transaction, id: string): Promise<ApiKey | null> {
    const result = await tx.query(
      `SELECT id, tenant_id, name, prefix, secret_hash, key_type, scopes, status,
              channel_id, expires_at, last_used_at, created_at, updated_at,
              revoked_at, rotated_from_id
       FROM api_keys WHERE id = $1`,
      [id],
      { operation: 'api_keys.find_by_id' },
    );
    if (result.rows.length === 0) return null;
    return mapFull(parseOrThrow(fullRowSchema, result.rows[0], 'api key row'));
  }

  async listByTenant(tx: Transaction, tenantId: string): Promise<readonly ApiKeySummary[]> {
    const result = await tx.query(
      `SELECT id, tenant_id, name, prefix, key_type, scopes, status,
              expires_at, last_used_at, created_at, updated_at
       FROM api_keys
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
      { operation: 'api_keys.list_by_tenant' },
    );

    return result.rows.map((row) => mapSummary(parseOrThrow(summaryRowSchema, row, 'api key row')));
  }

  async revoke(tx: Transaction, id: string, revokedAt: Date): Promise<void> {
    await tx.query(
      `UPDATE api_keys
       SET status = 'REVOKED', revoked_at = $2, updated_at = $2
       WHERE id = $1 AND status = 'ACTIVE'`,
      [id, revokedAt],
      { operation: 'api_keys.revoke' },
    );
  }

  async markRotated(tx: Transaction, id: string, revokedAt: Date): Promise<void> {
    await tx.query(
      `UPDATE api_keys
       SET status = 'REVOKED', revoked_at = $2, updated_at = $2
       WHERE id = $1 AND status = 'ACTIVE'`,
      [id, revokedAt],
      { operation: 'api_keys.mark_rotated' },
    );
  }

  async touchLastUsed(tx: Transaction, id: string, usedAt: Date): Promise<void> {
    await tx.query(
      `UPDATE api_keys SET last_used_at = $2, updated_at = $2 WHERE id = $1`,
      [id, usedAt],
      { operation: 'api_keys.touch_last_used' },
    );
  }
}
