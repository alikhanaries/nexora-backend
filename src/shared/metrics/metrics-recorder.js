/**
 * Metrics port.
 *
 * The method set is deliberately closed rather than a generic
 * "create any metric" facade: every label combination below is bounded, which
 * is what keeps Prometheus cardinality under control. Unbounded identifiers
 * (requestId, userId, orderId, productId) must never become labels - they
 * belong in logs and traces.
 */
/** Used by unit tests and when metrics are disabled by configuration. */
export const noopMetricsRecorder = {
    recordHttpRequest: () => undefined,
    recordDbQuery: () => undefined,
    recordRedisOperation: () => undefined,
    recordQueueJobEnqueued: () => undefined,
    recordQueueJob: () => undefined,
    recordRateLimitHit: () => undefined,
    recordAuthEvent: () => undefined,
    recordCommerceOperation: () => undefined,
    recordWebhookDelivery: () => undefined,
    recordCatalogSync: () => undefined,
    recordCatalogSyncReconciliation: () => undefined,
    recordRetentionCleanup: () => undefined,
    setDbPoolConnections: () => undefined,
    render: () => Promise.resolve(''),
    contentType: 'text/plain; charset=utf-8',
};
export function classifyStatus(statusCode) {
    if (statusCode >= 500)
        return 'server_error';
    if (statusCode >= 400)
        return 'client_error';
    return 'success';
}
