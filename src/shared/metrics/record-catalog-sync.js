/**
 * @param {import('./metrics-recorder.js').MetricsRecorder | undefined} metrics
 * @param {string} outcome
 */
export function recordCatalogSyncOutcome(metrics, outcome) {
    metrics?.recordCatalogSync?.({ outcome });
}
