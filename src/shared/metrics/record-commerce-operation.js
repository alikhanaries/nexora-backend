export async function withCommerceMetric(metrics, operation, work) {
    if (metrics === undefined) {
        return work();
    }
    try {
        const result = await work();
        metrics.recordCommerceOperation({ operation, outcome: 'success' });
        return result;
    }
    catch (error) {
        metrics.recordCommerceOperation({ operation, outcome: 'failure' });
        throw error;
    }
}
export function recordCommerceOutcome(metrics, operation, outcome) {
    metrics?.recordCommerceOperation({ operation, outcome });
}
