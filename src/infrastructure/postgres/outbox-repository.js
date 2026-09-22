import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { clampBatchSize } from '../../shared/pagination/index.js';
import { parseOrThrow } from '../../shared/validation/index.js';
/**
 * Outbox persistence.
 *
 * Writing goes through the caller's transaction so the event commits with the
 * business change. Claiming and marking run on their own connections because
 * the publisher must not hold a transaction open across a network call.
 */
/** Rows are `unknown` at the driver boundary and are narrowed, never cast. */
const outboxRowSchema = z.object({
    id: z.string().uuid(),
    event_type: z.string(),
    event_version: z.number().int(),
    aggregate_type: z.string(),
    aggregate_id: z.string(),
    tenant_id: z.string().uuid().nullable(),
    payload: z.record(z.unknown()),
    correlation_id: z.string().nullable(),
    occurred_at: z.date(),
    attempt_count: z.number().int(),
});
const outboxReadRowSchema = outboxRowSchema.omit({ attempt_count: true });
function toIntegrationEvent(row) {
    return {
        id: row.id,
        type: row.event_type,
        version: row.event_version,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        tenantId: row.tenant_id,
        payload: row.payload,
        occurredAt: row.occurred_at,
        correlationId: row.correlation_id,
    };
}
export class PostgresOutboxRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    async record(transaction, event) {
        await this.recordMany(transaction, [event]);
    }
    async recordMany(transaction, events) {
        if (events.length === 0)
            return;
        // One multi-row INSERT rather than a loop: the events belong to the same
        // business transaction and a round trip per event is wasted latency.
        const values = [];
        const placeholders = events.map((event, index) => {
            const base = index * 9;
            values.push(event.id ?? randomUUID(), event.type, event.version, event.aggregateType, event.aggregateId, event.tenantId ?? null, JSON.stringify(event.payload), event.correlationId ?? null, event.occurredAt ?? new Date());
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::jsonb, $${base + 8}, $${base + 9})`;
        });
        await transaction.query(`INSERT INTO outbox_events
         (id, event_type, event_version, aggregate_type, aggregate_id, tenant_id, payload, correlation_id, occurred_at)
       VALUES ${placeholders.join(', ')}`, values, { operation: 'outbox.record' });
    }
    /**
     * Atomically claims a bounded batch of pending events.
     *
     * `FOR UPDATE SKIP LOCKED` is what lets several publisher replicas run
     * concurrently: each grabs a disjoint set instead of blocking on the same
     * rows. `claimed_at` is stamped so a publisher that dies mid-batch can have
     * its claim reaped by {@link releaseStaleClaims}.
     */
    async claimBatch(batchSize, maxAttempts) {
        const limit = clampBatchSize(batchSize);
        const result = await this.database.query(`WITH claimed AS (
         SELECT id
         FROM outbox_events
         WHERE published_at IS NULL
           AND dead_lettered_at IS NULL
           AND claimed_at IS NULL
           AND attempt_count < $2
         ORDER BY occurred_at, id
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE outbox_events AS o
       SET claimed_at = now(), attempt_count = o.attempt_count + 1
       FROM claimed
       WHERE o.id = claimed.id
       RETURNING o.id, o.event_type, o.event_version, o.aggregate_type, o.aggregate_id,
                 o.tenant_id, o.payload, o.correlation_id, o.occurred_at, o.attempt_count`, [limit, maxAttempts], { operation: 'outbox.claim_batch' });
        return result.rows.map((row) => {
            const parsed = parseOrThrow(outboxRowSchema, row, 'outbox_events row');
            return { ...toIntegrationEvent(parsed), attemptCount: parsed.attempt_count };
        });
    }
    /** Marks events as handed to the queue. */
    async markPublished(eventIds) {
        if (eventIds.length === 0)
            return;
        await this.database.query(`UPDATE outbox_events
       SET published_at = now(), claimed_at = NULL, last_error = NULL
       WHERE id = ANY($1::uuid[])`, [[...eventIds]], { operation: 'outbox.mark_published' });
    }
    /**
     * Returns a failed event to the pending pool, or dead-letters it once it has
     * exhausted `maxAttempts`.
     *
     * Dead-lettered events are kept, not deleted: losing an integration event
     * silently is worse than leaving it for an operator to inspect.
     */
    async markFailed(eventId, error, maxAttempts) {
        await this.database.query(`UPDATE outbox_events
       SET claimed_at = NULL,
           last_error = left($2, 1000),
           dead_lettered_at = CASE WHEN attempt_count >= $3 THEN now() ELSE NULL END
       WHERE id = $1`, [eventId, error, maxAttempts], { operation: 'outbox.mark_failed' });
    }
    /**
     * Releases claims older than `staleAfterMs`.
     *
     * Without this, a publisher killed between claim and publish would leave its
     * batch claimed forever and those events would never be delivered.
     */
    async releaseStaleClaims(staleAfterMs) {
        const result = await this.database.query(`UPDATE outbox_events
       SET claimed_at = NULL
       WHERE claimed_at IS NOT NULL
         AND published_at IS NULL
         AND claimed_at < now() - make_interval(secs => $1)`, [staleAfterMs / 1_000], { operation: 'outbox.release_stale_claims' });
        return result.rowCount;
    }
    async countPending() {
        const result = await this.database.query(`SELECT count(*)::int AS pending
       FROM outbox_events
       WHERE published_at IS NULL AND dead_lettered_at IS NULL`, [], { operation: 'outbox.count_pending' });
        const parsed = parseOrThrow(z.object({ pending: z.number().int() }), result.rows[0] ?? { pending: 0 }, 'outbox pending count');
        return parsed.pending;
    }
    /**
     * Deletes successfully published events older than `cutoff`.
     *
     * Unpublished, claimed, retryable and dead-lettered rows are never removed.
     */
    async purgePublishedBefore(cutoff, batchSize) {
        const limit = clampBatchSize(batchSize);
        const result = await this.database.query(`DELETE FROM outbox_events
       WHERE id IN (
         SELECT id
         FROM outbox_events
         WHERE published_at IS NOT NULL
           AND published_at < $1
         ORDER BY published_at, id
         LIMIT $2
       )`, [cutoff, limit], { operation: 'outbox.purge_published' });
        return result.rowCount;
    }
    /** Loads a persisted integration event for webhook payload delivery. */
    async findByIdForTenant(tenantId, eventId) {
        const result = await this.database.query(`SELECT id, event_type, event_version, aggregate_type, aggregate_id,
                tenant_id, payload, correlation_id, occurred_at
       FROM outbox_events
       WHERE id = $1 AND tenant_id = $2`, [eventId, tenantId], { operation: 'outbox.find_by_id_for_tenant' });
        const row = result.rows[0];
        if (row === undefined) {
            return null;
        }
        return toIntegrationEvent(parseOrThrow(outboxReadRowSchema, row, 'outbox_events row'));
    }
}
