import { performance } from 'node:perf_hooks';
import { Worker } from 'bullmq';
import { createRequestContext, runWithRequestContext, } from '../../shared/context/request-context.js';
import { generateRequestId } from '../../shared/context/request-id.js';
import { describeErrorForLog } from '../../shared/errors/index.js';
/**
 * Runs registered handlers against BullMQ queues.
 *
 * Each job executes inside its own request context, so a job's logs carry a
 * correlation id exactly like an HTTP request's do, and the same
 * context-aware logger works in both places.
 */
export class BullMqWorkerRuntime {
    connection;
    config;
    metrics;
    workers = [];
    logger;
    constructor(connection, config, logger, metrics) {
        this.connection = connection;
        this.config = config;
        this.metrics = metrics;
        this.logger = logger.child({ component: 'worker-runtime' });
    }
    hasRegisteredWorkers() {
        return this.workers.length > 0;
    }
    /** Starts consuming `queueName`. Handlers must be idempotent. */
    register(queueName, handler) {
        const worker = new Worker(queueName, async (job) => {
            await this.runJob(queueName, job, handler);
        }, {
            connection: this.connection,
            prefix: this.config.prefix,
            concurrency: this.config.workerConcurrency,
            // If a handler hangs, the lock must expire so another worker can
            // retry rather than the job being stuck forever.
            lockDuration: this.config.jobTimeoutMs,
        });
        worker.on('failed', (job, error) => {
            this.logger.error({ queue: queueName, jobId: job?.id, attempt: job?.attemptsMade, reason: error.message }, 'Job failed');
        });
        worker.on('error', (error) => {
            this.logger.error({ queue: queueName, reason: error.message }, 'Worker error');
        });
        this.workers.push(worker);
        this.logger.info({ queue: queueName, concurrency: this.config.workerConcurrency }, 'Worker registered');
    }
    /**
     * Stops accepting new jobs and waits for active ones to finish.
     *
     * `close(false)` is a graceful close: BullMQ stops fetching and lets
     * in-flight handlers complete.
     */
    async close() {
        await Promise.all(this.workers.map((worker) => worker.close(false)));
        this.workers.length = 0;
        this.logger.info({}, 'Workers closed');
    }
    async runJob(queueName, job, handler) {
        const startedAt = performance.now();
        const payload = isPayload(job.data) ? job.data : {};
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
                    moveToDelayed: async (delayMs) => {
                        if (delayMs <= 0) {
                            return;
                        }
                        await job.moveToDelayed(Date.now() + delayMs);
                    },
                });
            });
            this.record(queueName, job.name, 'completed', startedAt);
        }
        catch (error) {
            this.record(queueName, job.name, 'failed', startedAt);
            this.logger.error({ queue: queueName, jobId: job.id, err: describeErrorForLog(error) }, 'Job handler threw');
            // Rethrow so BullMQ applies the configured retry/backoff policy.
            throw error;
        }
    }
    record(queue, jobName, outcome, startedAt) {
        this.metrics.recordQueueJob({
            queue,
            jobName,
            outcome,
            durationSeconds: (performance.now() - startedAt) / 1_000,
        });
    }
}
function isPayload(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function readCorrelationId(payload) {
    const value = payload['correlationId'];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
