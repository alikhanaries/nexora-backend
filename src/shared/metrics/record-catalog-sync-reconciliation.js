/**
 * @param {import('./metrics-recorder.js').MetricsRecorder | undefined} metrics
 * @param {{ offersScanned: number, offersSkipped: number, jobsPlanned: number, channelsVisited: number }} stats
 * @param {number} durationSeconds
 */
export function recordCatalogSyncReconciliationOutcome(metrics, stats, durationSeconds) {
    metrics?.recordCatalogSyncReconciliation?.({
        outcome: 'success',
        jobsPlanned: stats.jobsPlanned,
        offersSkipped: stats.offersSkipped,
        durationSeconds,
    });
}

/**
 * @param {import('./metrics-recorder.js').MetricsRecorder | undefined} metrics
 */
export function recordCatalogSyncReconciliationFailure(metrics) {
    metrics?.recordCatalogSyncReconciliation?.({
        outcome: 'failure',
    });
}
