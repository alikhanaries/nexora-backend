/**
 * Metrics port.
 *
 * The method set is deliberately closed rather than a generic
 * "create any metric" facade: every label combination below is bounded, which
 * is what keeps Prometheus cardinality under control. Unbounded identifiers
 * (requestId, userId, orderId, productId) must never become labels - they
 * belong in logs and traces.
 */

export type RequestOutcome = 'success' | 'client_error' | 'server_error';

export interface HttpRequestSample {
  readonly method: string;
  /** Route template such as `/health/ready`, never the raw URL. */
  readonly route: string;
  readonly statusCode: number;
  readonly durationSeconds: number;
}

export interface DbQuerySample {
  /** Short stable name, e.g. `outbox.claim_batch`. */
  readonly operation: string;
  readonly durationSeconds: number;
  readonly success: boolean;
}

export interface RedisOperationSample {
  readonly operation: string;
  readonly durationSeconds: number;
  readonly success: boolean;
}

export interface QueueJobSample {
  readonly queue: string;
  readonly jobName: string;
  readonly outcome: 'completed' | 'failed';
  readonly durationSeconds: number;
}

export interface DbPoolSnapshot {
  readonly total: number;
  readonly idle: number;
  readonly waiting: number;
}

export type AuthMethodLabel = 'jwt' | 'api-key';
export type AuthOutcomeLabel = 'success' | 'failure';

export interface AuthEventSample {
  readonly method: AuthMethodLabel;
  readonly outcome: AuthOutcomeLabel;
}

export interface MetricsRecorder {
  recordHttpRequest(sample: HttpRequestSample): void;
  recordDbQuery(sample: DbQuerySample): void;
  recordRedisOperation(sample: RedisOperationSample): void;
  recordQueueJobEnqueued(queue: string, jobName: string): void;
  recordQueueJob(sample: QueueJobSample): void;
  recordRateLimitHit(policy: string, allowed: boolean): void;
  recordAuthEvent(sample: AuthEventSample): void;
  setDbPoolConnections(snapshot: DbPoolSnapshot): void;
  /** Prometheus exposition text. */
  render(): Promise<string>;
  readonly contentType: string;
}

/** Used by unit tests and when metrics are disabled by configuration. */
export const noopMetricsRecorder: MetricsRecorder = {
  recordHttpRequest: () => undefined,
  recordDbQuery: () => undefined,
  recordRedisOperation: () => undefined,
  recordQueueJobEnqueued: () => undefined,
  recordQueueJob: () => undefined,
  recordRateLimitHit: () => undefined,
  recordAuthEvent: () => undefined,
  setDbPoolConnections: () => undefined,
  render: () => Promise.resolve(''),
  contentType: 'text/plain; charset=utf-8',
};

export function classifyStatus(statusCode: number): RequestOutcome {
  if (statusCode >= 500) return 'server_error';
  if (statusCode >= 400) return 'client_error';
  return 'success';
}
