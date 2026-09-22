/**
 * @typedef {'outbox' | 'inbox' | 'idempotency' | 'run'} RetentionCleanupResource
 */

/**
 * @param {import('./metrics-recorder.js').MetricsRecorder | undefined} metrics
 * @param {{ outboxDeleted: number, inboxDeleted: number, idempotencyDeleted: number }} stats
 * @param {number} durationSeconds
 */
export function recordRetentionCleanupOutcome(metrics, stats, durationSeconds) {
    metrics?.recordRetentionCleanup({
        outcome: 'success',
        outboxDeleted: stats.outboxDeleted,
        inboxDeleted: stats.inboxDeleted,
        idempotencyDeleted: stats.idempotencyDeleted,
        durationSeconds,
    });
}

/**
 * @param {import('./metrics-recorder.js').MetricsRecorder | undefined} metrics
 * @param {RetentionCleanupResource} resource
 */
export function recordRetentionCleanupFailure(metrics, resource) {
    metrics?.recordRetentionCleanup({
        outcome: 'failure',
        resource,
    });
}
