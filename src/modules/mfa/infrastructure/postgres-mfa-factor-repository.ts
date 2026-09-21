import { z } from 'zod';
import type { Transaction } from '../../../shared/persistence/index.js';
import { parseOrThrow } from '../../../shared/validation/index.js';
import type {
  CreateMfaFactorRecord,
  MfaFactorRepository,
} from '../application/ports/mfa-factor-repository.js';
import type { MfaFactor, MfaFactorStatus } from '../domain/mfa-factor.js';

const rowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  factor_type: z.literal('TOTP'),
  status: z.enum(['PENDING', 'ACTIVE', 'REVOKED']),
  secret_encrypted: z.string(),
  label: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  activated_at: z.coerce.date().nullable(),
  revoked_at: z.coerce.date().nullable(),
});

function mapRow(row: z.infer<typeof rowSchema>): MfaFactor {
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    factorType: row.factor_type,
    status: row.status,
    secretEncrypted: row.secret_encrypted,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at,
    revokedAt: row.revoked_at,
  };
}

export class PostgresMfaFactorRepository implements MfaFactorRepository {
  async createPending(tx: Transaction, record: CreateMfaFactorRecord): Promise<MfaFactor> {
    const result = await tx.query(
      `INSERT INTO mfa_factors (id, user_id, tenant_id, secret_encrypted, label)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, tenant_id, factor_type, status, secret_encrypted, label,
                 created_at, updated_at, activated_at, revoked_at`,
      [record.id, record.userId, record.tenantId, record.secretEncrypted, record.label],
      { operation: 'mfa_factors.create' },
    );

    return mapRow(parseOrThrow(rowSchema, result.rows[0], 'mfa factor row'));
  }

  async findById(tx: Transaction, id: string): Promise<MfaFactor | null> {
    const result = await tx.query(
      `SELECT id, user_id, tenant_id, factor_type, status, secret_encrypted, label,
              created_at, updated_at, activated_at, revoked_at
       FROM mfa_factors WHERE id = $1`,
      [id],
      { operation: 'mfa_factors.find_by_id' },
    );
    if (result.rows.length === 0) return null;
    return mapRow(parseOrThrow(rowSchema, result.rows[0], 'mfa factor row'));
  }

  async findActiveByUser(
    tx: Transaction,
    userId: string,
    tenantId: string,
  ): Promise<MfaFactor | null> {
    const result = await tx.query(
      `SELECT id, user_id, tenant_id, factor_type, status, secret_encrypted, label,
              created_at, updated_at, activated_at, revoked_at
       FROM mfa_factors
       WHERE user_id = $1 AND tenant_id = $2 AND status = 'ACTIVE'
       LIMIT 1`,
      [userId, tenantId],
      { operation: 'mfa_factors.find_active' },
    );
    if (result.rows.length === 0) return null;
    return mapRow(parseOrThrow(rowSchema, result.rows[0], 'mfa factor row'));
  }

  async activate(tx: Transaction, id: string, activatedAt: Date): Promise<void> {
    await tx.query(
      `UPDATE mfa_factors
       SET status = 'ACTIVE', activated_at = $2, updated_at = $2
       WHERE id = $1 AND status = 'PENDING'`,
      [id, activatedAt],
      { operation: 'mfa_factors.activate' },
    );
  }

  async revokeAllForUser(
    tx: Transaction,
    userId: string,
    tenantId: string,
    revokedAt: Date,
  ): Promise<void> {
    await tx.query(
      `UPDATE mfa_factors
       SET status = 'REVOKED', revoked_at = $3, updated_at = $3
       WHERE user_id = $1 AND tenant_id = $2 AND status = 'ACTIVE'`,
      [userId, tenantId, revokedAt],
      { operation: 'mfa_factors.revoke_active' },
    );
  }

  async updateStatus(tx: Transaction, id: string, status: MfaFactorStatus): Promise<void> {
    await tx.query(
      `UPDATE mfa_factors SET status = $2, updated_at = now() WHERE id = $1`,
      [id, status],
      { operation: 'mfa_factors.update_status' },
    );
  }
}
