/**
 * @typedef {'attempt' | 'success' | 'retryable_failure' | 'dead_lettered'} WebhookDeliveryMetricOutcome
 */

/**
 * @param {import('./metrics-recorder.js').MetricsRecorder | undefined} metrics
 * @param {WebhookDeliveryMetricOutcome} outcome
 * @param {number} [durationMs]
 */
export function recordWebhookDeliveryOutcome(metrics, outcome, durationMs) {
    metrics?.recordWebhookDelivery({ outcome, durationMs });
}
