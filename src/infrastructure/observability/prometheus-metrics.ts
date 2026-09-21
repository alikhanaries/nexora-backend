import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import type {
  DbPoolSnapshot,
  DbQuerySample,
  HttpRequestSample,
  MetricsRecorder,
  QueueJobSample,
  RedisOperationSample,
} from '../../shared/metrics/index.js';
import { classifyStatus } from '../../shared/metrics/index.js';

/**
 * Prometheus implementation of the metrics port.
 *
 * Every label below is bounded by construction:
 *
 * - `route` is the Fastify route template, never the raw URL (`/orders/:id`,
 *   not `/orders/8f2c...`).
 * - `status_code` is bucketed into a status class as well, so dashboards do
 *   not have to enumerate codes.
 * - `operation`, `queue`, `job_name` and `policy` are developer-chosen
 *   constants.
 *
 * Request, user, order and product identifiers are deliberately absent: each
 * would create one time series per value and eventually take Prometheus down.
 */

const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const FAST_OPERATION_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];

export class PrometheusMetrics implements MetricsRecorder {
  readonly contentType: string;

  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<'method' | 'route' | 'status_code'>;
  private readonly httpRequestDuration: Histogram<'method' | 'route' | 'status_class'>;
  private readonly httpRequestErrorsTotal: Counter<'method' | 'route' | 'status_class'>;
  private readonly dbPoolConnections: Gauge<'state'>;
  private readonly dbQueryDuration: Histogram<'operation' | 'result'>;
  private readonly redisOperationsTotal: Counter<'operation' | 'result'>;
  private readonly redisOperationDuration: Histogram<'operation'>;
  private readonly queueJobsTotal: Counter<'queue' | 'job_name' | 'state'>;
  private readonly queueJobDuration: Histogram<'queue' | 'job_name'>;
  private readonly rateLimitHitsTotal: Counter<'policy' | 'outcome'>;

  constructor(serviceName: string) {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ service: serviceName });
    // Event-loop lag, heap usage and GC pauses: the signals that explain a
    // latency regression that the application-level metrics cannot.
    collectDefaultMetrics({ register: this.registry });
    this.contentType = this.registry.contentType;

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests handled, by route and status code.',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds.',
      labelNames: ['method', 'route', 'status_class'],
      buckets: DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.httpRequestErrorsTotal = new Counter({
      name: 'http_request_errors_total',
      help: 'HTTP requests that returned a 4xx or 5xx response.',
      labelNames: ['method', 'route', 'status_class'],
      registers: [this.registry],
    });

    this.dbPoolConnections = new Gauge({
      name: 'db_pool_connections',
      help: 'PostgreSQL pool connections by state (total, idle, waiting).',
      labelNames: ['state'],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'PostgreSQL query latency in seconds, by named operation.',
      labelNames: ['operation', 'result'],
      buckets: FAST_OPERATION_BUCKETS,
      registers: [this.registry],
    });

    this.redisOperationsTotal = new Counter({
      name: 'redis_operations_total',
      help: 'Redis operations by name and result.',
      labelNames: ['operation', 'result'],
      registers: [this.registry],
    });

    this.redisOperationDuration = new Histogram({
      name: 'redis_operation_duration_seconds',
      help: 'Redis operation latency in seconds.',
      labelNames: ['operation'],
      buckets: FAST_OPERATION_BUCKETS,
      registers: [this.registry],
    });

    this.queueJobsTotal = new Counter({
      name: 'queue_jobs_total',
      help: 'Queue jobs by queue, job name and lifecycle state.',
      labelNames: ['queue', 'job_name', 'state'],
      registers: [this.registry],
    });

    this.queueJobDuration = new Histogram({
      name: 'queue_job_duration_seconds',
      help: 'Queue job processing time in seconds.',
      labelNames: ['queue', 'job_name'],
      buckets: DURATION_BUCKETS,
      registers: [this.registry],
    });

    this.rateLimitHitsTotal = new Counter({
      name: 'rate_limit_hits_total',
      help: 'Rate limit evaluations by policy and outcome.',
      labelNames: ['policy', 'outcome'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(sample: HttpRequestSample): void {
    const statusClass = classifyStatus(sample.statusCode);
    this.httpRequestsTotal.inc({
      method: sample.method,
      route: sample.route,
      status_code: String(sample.statusCode),
    });
    this.httpRequestDuration.observe(
      { method: sample.method, route: sample.route, status_class: statusClass },
      sample.durationSeconds,
    );
    if (statusClass !== 'success') {
      this.httpRequestErrorsTotal.inc({
        method: sample.method,
        route: sample.route,
        status_class: statusClass,
      });
    }
  }

  recordDbQuery(sample: DbQuerySample): void {
    this.dbQueryDuration.observe(
      { operation: sample.operation, result: sample.success ? 'success' : 'error' },
      sample.durationSeconds,
    );
  }

  recordRedisOperation(sample: RedisOperationSample): void {
    this.redisOperationsTotal.inc({
      operation: sample.operation,
      result: sample.success ? 'success' : 'error',
    });
    this.redisOperationDuration.observe({ operation: sample.operation }, sample.durationSeconds);
  }

  recordQueueJobEnqueued(queue: string, jobName: string): void {
    this.queueJobsTotal.inc({ queue, job_name: jobName, state: 'enqueued' });
  }

  recordQueueJob(sample: QueueJobSample): void {
    this.queueJobsTotal.inc({
      queue: sample.queue,
      job_name: sample.jobName,
      state: sample.outcome,
    });
    this.queueJobDuration.observe(
      { queue: sample.queue, job_name: sample.jobName },
      sample.durationSeconds,
    );
  }

  recordRateLimitHit(policy: string, allowed: boolean): void {
    this.rateLimitHitsTotal.inc({ policy, outcome: allowed ? 'allowed' : 'limited' });
  }

  setDbPoolConnections(snapshot: DbPoolSnapshot): void {
    this.dbPoolConnections.set({ state: 'total' }, snapshot.total);
    this.dbPoolConnections.set({ state: 'idle' }, snapshot.idle);
    this.dbPoolConnections.set({ state: 'waiting' }, snapshot.waiting);
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }
}
