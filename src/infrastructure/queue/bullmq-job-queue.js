import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ServiceUnavailableError, toErrorMessage } from '../../shared/errors/index.js';
/**
 * BullMQ implementation of the JobQueue port.
 *
 * This file and the worker runtime are the only places allowed to import
 * BullMQ; everything else depends on the `JobQueue` interface so the backend
 * stays replaceable.
 *
 * BullMQ needs its own Redis connection with `maxRetriesPerRequest: null`
 * (it uses long-lived blocking reads), which is incompatible with the
 * fail-fast settings on the shared cache connection. Hence a dedicated client
 * rather than reusing RedisConnection.
 */
export function createQueueRedisConnection(config) {
    return new Redis(config.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    });
}
const DEFAULT_COMPLETED_RETENTION_SECONDS = 3_600;
const FAILED_RETENTION_COUNT = 1_000;
export class BullMqJobQueue {
    connection;
    config;
    metrics;
    queues = new Map();
    logger;
    closed = false;
    constructor(connection, config, logger, metrics) {
        this.connection = connection;
        this.config = config;
        this.metrics = metrics;
        this.logger = logger.child({ component: 'queue' });
    }
    async enqueue(queue, name, payload, options = {}) {
        return this.add(queue, name, payload, options, undefined);
    }
    async enqueueDelayed(queue, name, payload, delayMs, options = {}) {
        if (delayMs < 0)
            throw new Error('Delay must not be negative');
        return this.add(queue, name, payload, options, delayMs);
    }
    async remove(queue, jobId) {
        this.assertOpen();
        try {
            const job = await this.queue(queue).getJob(jobId);
            if (job === undefined)
                return false;
            // BullMQ refuses to remove a locked (actively processing) job. Reporting
            // false is honest: the caller must not assume the work was cancelled.
            const state = await job.getState();
            if (state === 'active') {
                this.logger.debug({ queue, jobId }, 'Refusing to remove an active job');
                return false;
            }
            await job.remove();
            return true;
        }
        catch (error) {
            throw new ServiceUnavailableError('Could not remove job', {
                queue,
                reason: toErrorMessage(error),
            });
        }
    }
    async healthCheck() {
        this.assertOpen();
        try {
            await this.connection.ping();
        }
        catch (error) {
            throw new ServiceUnavailableError('Queue backend is unavailable', {
                reason: toErrorMessage(error),
            });
        }
    }
    async close() {
        if (this.closed)
            return;
        this.closed = true;
        await Promise.all([...this.queues.values()].map((queue) => queue.close()));
        this.queues.clear();
        await this.connection.quit().catch(() => this.connection.disconnect());
        this.logger.info({}, 'Job queue closed');
    }
    async add(queue, name, payload, options, delayMs) {
        this.assertOpen();
        try {
            const job = await this.queue(queue).add(name, payload, {
                ...(options.jobId === undefined ? {} : { jobId: options.jobId }),
                ...(delayMs === undefined ? {} : { delay: delayMs }),
                ...(options.priority === undefined ? {} : { priority: options.priority }),
                attempts: options.attempts ?? this.config.defaultAttempts,
                backoff: { type: 'exponential', delay: this.config.backoffBaseMs },
                // Bounded retention: without it the completed/failed sets grow until
                // Redis runs out of memory.
                removeOnComplete: {
                    age: options.removeOnCompleteSeconds ?? DEFAULT_COMPLETED_RETENTION_SECONDS,
                },
                removeOnFail: { count: FAILED_RETENTION_COUNT },
            });
            this.metrics.recordQueueJobEnqueued(queue, name);
            return { id: job.id ?? 'unknown', queue, name };
        }
        catch (error) {
            throw new ServiceUnavailableError('Could not enqueue job', {
                queue,
                jobName: name,
                reason: toErrorMessage(error),
            });
        }
    }
    queue(name) {
        const existing = this.queues.get(name);
        if (existing !== undefined)
            return existing;
        const created = new Queue(name, { connection: this.connection, prefix: this.config.prefix });
        this.queues.set(name, created);
        return created;
    }
    assertOpen() {
        if (this.closed)
            throw new ServiceUnavailableError('Job queue is closed');
    }
}
