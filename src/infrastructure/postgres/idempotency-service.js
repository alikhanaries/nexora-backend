import { DatabaseError, IdempotencyConflictError, IdempotentRequestInProgressError, } from '../../shared/errors/index.js';
import { clampBatchSize } from '../../shared/pagination/index.js';
const NULL_TENANT = '00000000-0000-0000-0000-000000000000';
export class PostgresIdempotencyService {
    database;
    config;
    constructor(database, config) {
        this.database = database;
        this.config = config;
    }
    async execute(key, fingerprint, operation, toRecord, options = {}) {
        const existing = await this.findRecord(key);
        if (existing !== undefined) {
            return this.handleExisting(key, existing, fingerprint, operation, toRecord, options);
        }
        const inserted = await this.tryInsert(key, fingerprint);
        if (!inserted) {
            const raced = await this.findRecord(key);
            if (raced === undefined) {
                throw new IdempotentRequestInProgressError();
            }
            return this.handleExisting(key, raced, fingerprint, operation, toRecord, options);
        }
        return this.runAndPersist(key, operation, toRecord, options);
    }
    async purgeExpired(batchSize) {
        const limit = clampBatchSize(batchSize);
        const result = await this.database.query(`DELETE FROM idempotency_records
       WHERE ctid IN (
         SELECT ctid FROM idempotency_records
         WHERE expires_at < now()
         LIMIT $1
       )`, [limit], { operation: 'idempotency.purge_expired' });
        return result.rowCount;
    }
    async handleExisting(key, existing, fingerprint, operation, toRecord, options) {
        if (existing.requestFingerprint !== fingerprint) {
            throw new IdempotencyConflictError();
        }
        if (existing.status === 'processing') {
            throw new IdempotentRequestInProgressError();
        }
        if (existing.status === 'completed') {
            return { kind: 'replayed', value: existing.responseBody };
        }
        const claimed = await this.claimFailedForRetry(key);
        if (!claimed) {
            const raced = await this.findRecord(key);
            if (raced === undefined) {
                throw new IdempotentRequestInProgressError();
            }
            return this.handleExisting(key, raced, fingerprint, operation, toRecord, options);
        }
        return this.runAndPersist(key, operation, toRecord, options);
    }
    async runAndPersist(key, operation, toRecord, options = {}) {
        if (options.useTransaction === true) {
            try {
                const value = await this.database.execute(async (tx) => {
                    const result = await operation(tx);
                    await this.markCompletedInTransaction(tx, key, toRecord(result));
                    return result;
                }, key.tenantId !== null && key.tenantId !== undefined ? { tenantId: key.tenantId } : {});
                return { kind: 'executed', value };
            }
            catch (error) {
                await this.markFailed(key);
                throw error;
            }
        }
        let value;
        try {
            value = await operation();
        }
        catch (error) {
            await this.markFailed(key);
            throw error;
        }
        await this.markCompleted(key, toRecord(value));
        return { kind: 'executed', value };
    }
    async findRecord(key) {
        const result = await this.database.query(`SELECT request_fingerprint, status, response_body
       FROM idempotency_records
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5
         AND expires_at > now()`, [NULL_TENANT, key.tenantId, key.principalFingerprint, key.routeId, key.idempotencyKey], { operation: 'idempotency.find' });
        const row = result.rows[0];
        if (row === undefined)
            return undefined;
        return {
            requestFingerprint: String(row['request_fingerprint']),
            status: String(row['status']),
            responseBody: row['response_body'],
        };
    }
    async tryInsert(key, fingerprint) {
        const expiresAt = new Date(Date.now() + this.config.ttlSeconds * 1_000);
        const result = await this.database.query(`INSERT INTO idempotency_records (
         tenant_id, principal_fingerprint, route_id, idempotency_key,
         request_fingerprint, status, expires_at
       ) VALUES ($1, $2, $3, $4, $5, 'processing', $6)
       ON CONFLICT DO NOTHING
       RETURNING idempotency_key`, [
            key.tenantId,
            key.principalFingerprint,
            key.routeId,
            key.idempotencyKey,
            fingerprint,
            expiresAt,
        ], { operation: 'idempotency.insert' });
        return result.rowCount > 0;
    }
    async markCompletedInTransaction(transaction, key, record) {
        const result = await transaction.query(`UPDATE idempotency_records
       SET status = 'completed',
           response_status = $6,
           response_body = $7::jsonb,
           completed_at = now()
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5`, [
            NULL_TENANT,
            key.tenantId,
            key.principalFingerprint,
            key.routeId,
            key.idempotencyKey,
            record.statusCode,
            JSON.stringify(record.body),
        ], { operation: 'idempotency.mark_completed' });
        if (result.rowCount !== 1) {
            throw new DatabaseError('Idempotency record was not updated', undefined, {
                idempotencyKey: key.idempotencyKey,
                routeId: key.routeId,
            });
        }
    }
    async markCompleted(key, record) {
        await this.database.query(`UPDATE idempotency_records
       SET status = 'completed',
           response_status = $6,
           response_body = $7::jsonb,
           completed_at = now()
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5`, [
            NULL_TENANT,
            key.tenantId,
            key.principalFingerprint,
            key.routeId,
            key.idempotencyKey,
            record.statusCode,
            JSON.stringify(record.body),
        ], { operation: 'idempotency.mark_completed' });
    }
    async markFailed(key) {
        await this.database.query(`UPDATE idempotency_records
       SET status = 'failed', completed_at = now()
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5`, [NULL_TENANT, key.tenantId, key.principalFingerprint, key.routeId, key.idempotencyKey], { operation: 'idempotency.mark_failed' });
    }
    async claimFailedForRetry(key) {
        const result = await this.database.query(`UPDATE idempotency_records
       SET status = 'processing', completed_at = NULL, response_status = NULL, response_body = NULL
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5
         AND status = 'failed'
       RETURNING idempotency_key`, [NULL_TENANT, key.tenantId, key.principalFingerprint, key.routeId, key.idempotencyKey], { operation: 'idempotency.claim_failed' });
        return result.rowCount === 1;
    }
}
