import { performance } from 'node:perf_hooks';
import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { QueueConfig } from '../../shared/config/index.js';
import {
  createRequestContext,
  runWithRequestContext,
} from '../../shared/context/request-context.js';
import { generateRequestId } from '../../shared/context/request-id.js';
import { describeErrorForLog } from '../../shared/errors/index.js';
import type { Logger } from '../../shared/logging/index.js';
import type { MetricsRecorder } from '../../shared/metrics/index.js';
import type { JobHandler, JobPayload } from '../../shared/queue/index.js';

/**
 * Runs registered handlers against BullMQ queues.
 *
 * Each job executes inside its own request context, so a job's logs carry a
 * correlation id exactly like an HTTP request's do, and the same
 * context-aware logger works in both places.
 */
export class BullMqWorkerRuntime {
  private readonly workers: Worker[] = [];
  private readonly logger: Logger;

  constructor(
    private readonly connection: Redis,
    private readonly config: QueueConfig,
    logger: Logger,
    private readonly metrics: MetricsRecorder,
  ) {
    this.logger = logger.child({ component: 'worker-runtime' });
  }

  /** Starts consuming `queueName`. Handlers must be idempotent. */
  register(queueName: string, handler: JobHandler): void {
    const worker = new Worker(
      queueName,
      async (job: Job): Promise<void> => {
        await this.runJob(queueName, job, handler);
      },
      {
        connection: this.connection,
        prefix: this.config.prefix,
        concurrency: this.config.workerConcurrency,
        // If a handler hangs, the lock must expire so another worker can
        // retry rather than the job being stuck forever.
        lockDuration: this.config.jobTimeoutMs,
      },
    );

    worker.on('failed', (job: Job | undefined, error: Error) => {
      this.logger.error(
        { queue: queueName, jobId: job?.id, attempt: job?.attemptsMade, reason: error.message },
        'Job failed',
      );
    });
    worker.on('error', (error: Error) => {
      this.logger.error({ queue: queueName, reason: error.message }, 'Worker error');
    });

    this.workers.push(worker);
    this.logger.info(
      { queue: queueName, concurrency: this.config.workerConcurrency },
      'Worker registered',
    );
  }

  /**
   * Stops accepting new jobs and waits for active ones to finish.
   *
   * `close(false)` is a graceful close: BullMQ stops fetching and lets
   * in-flight handlers complete.
   */
  async close(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close(false)));
    this.workers.length = 0;
    this.logger.info({}, 'Workers closed');
  }

  private async runJob(queueName: string, job: Job, handler: JobHandler): Promise<void> {
    const startedAt = performance.now();
    const payload: JobPayload = isPayload(job.data) ? job.data : {};
    const correlationId = readCorrelationId(payload) ?? generateRequestId();

    const context = createRequestContext({ requestId: correlationId });

    try {
      await runWithRequestContext(context, async () => {
        await handler(payload, {
          id: job.id ?? 'unknown',
          name: job.name,
          queue: queueName,
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts ?? this.config.defaultAttempts,
        });
      });
      this.record(queueName, job.name, 'completed', startedAt);
    } catch (error) {
      this.record(queueName, job.name, 'failed', startedAt);
      this.logger.error(
        { queue: queueName, jobId: job.id, err: describeErrorForLog(error) },
        'Job handler threw',
      );
      // Rethrow so BullMQ applies the configured retry/backoff policy.
      throw error;
    }
  }

  private record(
    queue: string,
    jobName: string,
    outcome: 'completed' | 'failed',
    startedAt: number,
  ): void {
    this.metrics.recordQueueJob({
      queue,
      jobName,
      outcome,
      durationSeconds: (performance.now() - startedAt) / 1_000,
    });
  }
}

function isPayload(value: unknown): value is JobPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCorrelationId(payload: JobPayload): string | undefined {
  const value = payload['correlationId'];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
