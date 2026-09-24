import { DatabaseError, IdempotencyConflictError, IdempotentRequestInProgressError, } from '../../shared/errors/index.js';
import { clampBatchSize } from '../../shared/pagination/index.js';

const NULL_TENANT = '00000000-0000-0000-0000-000000000000';

/**
 * @typedef {object} IdempotencyQueryable
 * @property {(sql: string, parameters?: unknown[], options?: { operation?: string }) => Promise<{ rows: object[], rowCount: number }>} query
 */

export class PostgresIdempotencyService {
    database;
    config;

    constructor(database, config) {
        this.database = database;
        this.config = config;
    }

    async execute(key, fingerprint, operation, toRecord, options = {}) {
        return this.database.withSessionAdvisoryLock(this.buildAdvisoryLockKey(key), async (scope) => {
            return this.executeUnderLock(key, fingerprint, operation, toRecord, options, scope);
        });
    }

    /** Deletes expired records whose `expires_at` is older than `cutoff`. */
    async purgeExpiredBefore(cutoff, batchSize) {
        const limit = clampBatchSize(batchSize);
        const result = await this.database.query(`DELETE FROM idempotency_records
       WHERE ctid IN (
         SELECT ctid FROM idempotency_records
         WHERE expires_at < $1
         LIMIT $2
       )`, [cutoff, limit], { operation: 'idempotency.purge_expired' });
        return result.rowCount;
    }

    /**
     * @param {object} key
     * @param {string} fingerprint
     * @param {Function} operation
     * @param {Function} toRecord
     * @param {object} options
     * @param {{ query: IdempotencyQueryable['query'], runTransaction: Function }} scope
     */
    async executeUnderLock(key, fingerprint, operation, toRecord, options, scope) {
        const existing = await this.findRecord(key, scope);
        if (existing !== undefined) {
            return this.handleExisting(key, existing, fingerprint, operation, toRecord, options, scope);
        }
        const inserted = await this.tryInsert(key, fingerprint, scope);
        if (!inserted) {
            const raced = await this.findRecord(key, scope);
            if (raced === undefined) {
                throw new IdempotentRequestInProgressError();
            }
            return this.handleExisting(key, raced, fingerprint, operation, toRecord, options, scope);
        }
        return this.runAndPersist(key, operation, toRecord, options, scope);
    }

    /**
     * @param {object} key
     * @param {object} existing
     * @param {string} fingerprint
     * @param {Function} operation
     * @param {Function} toRecord
     * @param {object} options
     * @param {{ query: IdempotencyQueryable['query'], runTransaction: Function }} scope
     */
    async handleExisting(key, existing, fingerprint, operation, toRecord, options, scope) {
        if (existing.requestFingerprint !== fingerprint) {
            throw new IdempotencyConflictError();
        }
        if (existing.status === 'processing') {
            throw new IdempotentRequestInProgressError();
        }
        if (existing.status === 'completed') {
            return { kind: 'replayed', value: existing.responseBody };
        }
        const claimed = await this.claimFailedForRetry(key, scope);
        if (!claimed) {
            const raced = await this.findRecord(key, scope);
            if (raced === undefined) {
                throw new IdempotentRequestInProgressError();
            }
            return this.handleExisting(key, raced, fingerprint, operation, toRecord, options, scope);
        }
        return this.runAndPersist(key, operation, toRecord, options, scope);
    }

    /**
     * @param {object} key
     * @param {Function} operation
     * @param {Function} toRecord
     * @param {object} options
     * @param {{ query: IdempotencyQueryable['query'], runTransaction: Function }} scope
     */
    async runAndPersist(key, operation, toRecord, options = {}, scope) {
        if (options.useTransaction === true) {
            try {
                const value = await scope.runTransaction(async (tx) => {
                    const result = await operation(tx);
                    await this.markCompletedInTransaction(tx, key, toRecord(result));
                    return result;
                }, key.tenantId !== null && key.tenantId !== undefined ? { tenantId: key.tenantId } : {});
                return { kind: 'executed', value };
            }
            catch (error) {
                await this.markFailed(key, scope);
                throw error;
            }
        }
        let value;
        try {
            value = await operation();
        }
        catch (error) {
            await this.markFailed(key, scope);
            throw error;
        }
        await this.markCompleted(key, toRecord(value), scope);
        return { kind: 'executed', value };
    }

    /**
     * @param {object} key
     * @param {{ query: IdempotencyQueryable['query'] }} scope
     */
    async findRecord(key, scope) {
        const result = await scope.query(`SELECT request_fingerprint, status, response_body
       FROM idempotency_records
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5
         AND expires_at > now()`, [NULL_TENANT, key.tenantId, key.principalFingerprint, key.routeId, key.idempotencyKey], { operation: 'idempotency.find' });
        const row = result.rows[0];
        if (row === undefined) {
            return undefined;
        }
        return {
            requestFingerprint: String(row['request_fingerprint']),
            status: String(row['status']),
            responseBody: row['response_body'],
        };
    }

    /**
     * @param {object} key
     * @param {string} fingerprint
     * @param {{ query: IdempotencyQueryable['query'] }} scope
     */
    async tryInsert(key, fingerprint, scope) {
        const expiresAt = new Date(Date.now() + this.config.ttlSeconds * 1_000);
        const result = await scope.query(`INSERT INTO idempotency_records (
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

    /**
     * @param {object} key
     * @param {object} record
     * @param {{ query: IdempotencyQueryable['query'] }} scope
     */
    async markCompleted(key, record, scope) {
        await scope.query(`UPDATE idempotency_records
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

    /**
     * @param {object} key
     * @param {{ query: IdempotencyQueryable['query'] }} scope
     */
    async markFailed(key, scope) {
        await scope.query(`UPDATE idempotency_records
       SET status = 'failed', completed_at = now()
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5`, [NULL_TENANT, key.tenantId, key.principalFingerprint, key.routeId, key.idempotencyKey], { operation: 'idempotency.mark_failed' });
    }

    /**
     * @param {object} key
     * @param {{ query: IdempotencyQueryable['query'] }} scope
     */
    async claimFailedForRetry(key, scope) {
        const result = await scope.query(`UPDATE idempotency_records
       SET status = 'processing', completed_at = NULL, response_status = NULL, response_body = NULL
       WHERE COALESCE(tenant_id, $1::uuid) = COALESCE($2::uuid, $1::uuid)
         AND principal_fingerprint = $3
         AND route_id = $4
         AND idempotency_key = $5
         AND status = 'failed'
       RETURNING idempotency_key`, [NULL_TENANT, key.tenantId, key.principalFingerprint, key.routeId, key.idempotencyKey], { operation: 'idempotency.claim_failed' });
        return result.rowCount === 1;
    }

    /**
     * @param {object} key
     */
    buildAdvisoryLockKey(key) {
        return `idempotency:${key.tenantId ?? 'null'}:${key.principalFingerprint}:${key.routeId}:${key.idempotencyKey}`;
    }
}
