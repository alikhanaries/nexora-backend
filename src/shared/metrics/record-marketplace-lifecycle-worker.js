/**
 * @param {import('./metrics-recorder.js').MetricsRecorder | undefined} metrics
 * @param {string} outcome
 * @param {{ marketplaceKey?: string, operation?: string, source?: string }} [context]
 */
export function recordMarketplaceLifecycleWorkerOutcome(metrics, outcome, context) {
    metrics?.recordMarketplaceLifecycleWorker?.({
        outcome,
        ...(context?.marketplaceKey === undefined ? {} : { marketplace: context.marketplaceKey }),
        ...(context?.operation === undefined ? {} : { operation: context.operation }),
        ...(context?.source === undefined ? {} : { source: context.source }),
    });
}
