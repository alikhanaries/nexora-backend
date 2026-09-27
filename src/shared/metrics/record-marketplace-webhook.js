/**
 * @param {import('./metrics-recorder.js').MetricsRecorder | undefined} metrics
 * @param {string} outcome
 * @param {{ marketplaceKey?: string, operation?: string }} [context]
 */
export function recordMarketplaceWebhookOutcome(metrics, outcome, context) {
    metrics?.recordMarketplaceWebhook?.({
        outcome,
        ...(context?.marketplaceKey === undefined ? {} : { marketplace: context.marketplaceKey }),
        ...(context?.operation === undefined ? {} : { operation: context.operation }),
    });
}
