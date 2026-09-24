/**
 * @param {import('./metrics-recorder.js').MetricsRecorder | undefined} metrics
 * @param {string} outcome
 * @param {{ marketplaceKey?: string, operation?: string }} [context]
 */
export function recordCatalogSyncOutcome(metrics, outcome, context) {
    metrics?.recordCatalogSync?.({
        outcome,
        ...(context?.marketplaceKey === undefined ? {} : { marketplace: context.marketplaceKey }),
        ...(context?.operation === undefined ? {} : { operation: context.operation }),
    });
}
