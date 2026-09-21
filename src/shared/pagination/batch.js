/**
 * Bounded batch sizing for infrastructure queries.
 *
 * Every background sweep (outbox claim, inbox cleanup, idempotency expiry)
 * must read a bounded page: an unbounded `SELECT` is the classic way a healthy
 * table turns into an out-of-memory incident.
 *
 * Client-facing page/cursor envelopes are intentionally not defined yet; they
 * ship with the first read API so their shape is driven by a real consumer.
 */
export const MIN_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 1_000;
export function clampBatchSize(requested, max = MAX_BATCH_SIZE) {
    if (!Number.isFinite(requested))
        return MIN_BATCH_SIZE;
    const upperBound = Math.min(max, MAX_BATCH_SIZE);
    return Math.min(Math.max(Math.trunc(requested), MIN_BATCH_SIZE), upperBound);
}
