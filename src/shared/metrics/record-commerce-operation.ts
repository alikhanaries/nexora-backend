import type {
  CommerceOperationLabel,
  CommerceOutcomeLabel,
  MetricsRecorder,
} from './metrics-recorder.js';

export async function withCommerceMetric<T>(
  metrics: MetricsRecorder | undefined,
  operation: CommerceOperationLabel,
  work: () => Promise<T>,
): Promise<T> {
  if (metrics === undefined) {
    return work();
  }

  try {
    const result = await work();
    metrics.recordCommerceOperation({ operation, outcome: 'success' });
    return result;
  } catch (error) {
    metrics.recordCommerceOperation({ operation, outcome: 'failure' });
    throw error;
  }
}

export function recordCommerceOutcome(
  metrics: MetricsRecorder | undefined,
  operation: CommerceOperationLabel,
  outcome: CommerceOutcomeLabel,
): void {
  metrics?.recordCommerceOperation({ operation, outcome });
}
