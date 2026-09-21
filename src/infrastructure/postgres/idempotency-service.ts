import type { IdempotencyConfig } from '../../shared/config/index.js';
import {
  IdempotencyConflictError,
  IdempotentRequestInProgressError,
} from '../../shared/errors/index.js';
import type {
  IdempotencyKey,
  IdempotencyOutcome,
  IdempotencyRecordResult,
  IdempotencyService,
  RequestFingerprint,
} from '../../shared/idempotency/index.js';
import { clampBatchSize } from '../../shared/pagination/index.js';
import type { PostgresDatabase } from './postgres-database.js';

const NULL_TENANT = '00000000-0000-0000-0000-000000000000';

interface ExistingRecord {
  readonly requestFingerprint: string;
  readonly status: 'processing' | 'completed' | 'failed';
  readonly responseBody: unknown;
}

export class PostgresIdempotencyService implements IdempotencyService {
  constructor(
    private readonly database: PostgresDatabase,
    private readonly config: IdempotencyConfig,
  ) {}

  async execute<T>(
    key: IdempotencyKey,
    fingerprint: RequestFingerprint,
    operation: () => Promise<T>,
    toRecord: (value: T) => IdempotencyRecordResult,
  ): Promise<IdempotencyOutcome<T>> {
    const existing = await this.findRecord(key);

    if (existing !== undefined) {
      return this.handleExisting(key, existing, fingerprint, operation, toRecord);
    }

    const inserted = await this.tryInsert(key, fingerprint);
    if (!inserted) {
      const raced = await this.findRecord(key);
      if (raced === undefined) {
        throw new IdempotentRequestInProgressError();
      }
      return this.handleExisting(key, raced, fingerprint, operation, toRecord);
    }

    return this.runAndPersist(key, operation, toRecord);
  }

  async purgeExpired(batchSize: number): Promise<number> {
    const limit = clampBatchSize(batchSize);
    const result = await this.database.query(
      `DELETE FROM idempotency_records
       WHERE ctid IN (
         SELECT ctid FROM idempotency_records
         WHERE expires_at < now()
         LIMIT $1
       )`,
      [limit],
      { operation: 'idempotency.purge_expired' },
    );
    return result.rowCount;
  }

  private async handleExisting<T>(
    key: IdempotencyKey,
    existing: ExistingRecord,
    fingerprint: RequestFingerprint,
    operation: () => Promise<T>,
    toRecord: (value: T) => IdempotencyRecordResult,
  ): Promise<IdempotencyOutcome<T>> {
    if (existing.requestFingerprint !== fingerprint) {
      throw new IdempotencyConflictError();
    }

    if (existing.status === 'processing') {
      throw new IdempotentRequestInProgressError();
    }

    if (existing.status === 'completed') {
      return { kind: 'replayed', value: existing.responseBody as T };
    }

    await this.resetToProcessing(key);
    return this.runAndPersist(key, operation, toRecord);
  }

  private async runAndPersist<T>(
    key: IdempotencyKey,
    operation: () => Promise<T>,
    toRecord: (value: T) => IdempotencyRecordResult,
  ): Promise<IdempotencyOutcome<T>> {
    try {
      const value = await operation();
      await this.markCompleted(key, toRecord(value));
      return { kind: 'executed', value };
    } catch (error) {
      await this.markFailed(key);
      throw error;
    }
  }

  private async findRecord(key: IdempotencyKey): Promise<ExistingRecord | undefined> {
    const result = await this.database.query(
      `SELECT request_fingerprint, status, response_body
       FROM idempotency_records
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5
         AND expires_at > now()`,
      [NULL_TENANT, key.tenantId, key.principalFingerprint, key.routeId, key.idempotencyKey],
      { operation: 'idempotency.find' },
    );

    const row = result.rows[0];
    if (row === undefined) return undefined;

    return {
      requestFingerprint: String(row['request_fingerprint']),
      status: String(row['status']) as ExistingRecord['status'],
      responseBody: row['response_body'],
    };
  }

  private async tryInsert(key: IdempotencyKey, fingerprint: RequestFingerprint): Promise<boolean> {
    const expiresAt = new Date(Date.now() + this.config.ttlSeconds * 1_000);
    const result = await this.database.query(
      `INSERT INTO idempotency_records (
         tenant_id, principal_fingerprint, route_id, idempotency_key,
         request_fingerprint, status, expires_at
       ) VALUES ($1, $2, $3, $4, $5, 'processing', $6)
       ON CONFLICT DO NOTHING
       RETURNING idempotency_key`,
      [
        key.tenantId,
        key.principalFingerprint,
        key.routeId,
        key.idempotencyKey,
        fingerprint,
        expiresAt,
      ],
      { operation: 'idempotency.insert' },
    );
    return result.rowCount > 0;
  }

  private async markCompleted(key: IdempotencyKey, record: IdempotencyRecordResult): Promise<void> {
    await this.database.query(
      `UPDATE idempotency_records
       SET status = 'completed',
           response_status = $6,
           response_body = $7::jsonb,
           completed_at = now()
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5`,
      [
        NULL_TENANT,
        key.tenantId,
        key.principalFingerprint,
        key.routeId,
        key.idempotencyKey,
        record.statusCode,
        JSON.stringify(record.body),
      ],
      { operation: 'idempotency.mark_completed' },
    );
  }

  private async markFailed(key: IdempotencyKey): Promise<void> {
    await this.database.query(
      `UPDATE idempotency_records
       SET status = 'failed', completed_at = now()
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5`,
      [NULL_TENANT, key.tenantId, key.principalFingerprint, key.routeId, key.idempotencyKey],
      { operation: 'idempotency.mark_failed' },
    );
  }

  private async resetToProcessing(key: IdempotencyKey): Promise<void> {
    await this.database.query(
      `UPDATE idempotency_records
       SET status = 'processing', completed_at = NULL, response_status = NULL, response_body = NULL
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5`,
      [NULL_TENANT, key.tenantId, key.principalFingerprint, key.routeId, key.idempotencyKey],
      { operation: 'idempotency.reset_processing' },
    );
  }
}
