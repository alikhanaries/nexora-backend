/**
 * Shared Redis connection for cache, rate limiting, and distributed locks.
 *
 * Uses fail-fast settings (no offline command queue) distinct from the BullMQ
 * connection, which requires blocking reads.
 */
import { performance } from 'node:perf_hooks';
import { Redis } from 'ioredis';
import { ServiceUnavailableError, toErrorMessage } from '../../shared/errors/index.js';
/** ioredis client options: fail-fast, bounded retries, lazy connect. */
function buildOptions(config, logger) {
    return {
        connectTimeout: config.connectTimeoutMs,
        commandTimeout: config.commandTimeoutMs,
        // Fail fast instead of queueing commands forever while disconnected: a
        // growing offline queue turns a Redis blip into an out-of-memory crash.
        enableOfflineQueue: false,
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        retryStrategy: (attempt) => {
            const delayMs = Math.min(attempt * 200, 5_000);
            logger.warn({ attempt, delayMs }, 'Redis reconnect scheduled');
            return delayMs;
        },
    };
}
/** Lifecycle-managed ioredis client with metrics and normalized errors. */
export class RedisConnection {
    client;
    logger;
    metrics;
    closed = false;
    /** Creates lazy ioredis client with error/ready logging. */
    constructor({ config, logger, metrics }) {
        this.logger = logger.child({ component: 'redis' });
        this.metrics = metrics;
        this.client = new Redis(config.url, buildOptions(config, this.logger));
        this.client.on('error', (error) => {
            // ioredis emits 'error' on every failed reconnect attempt. Without a
            // listener Node treats it as an unhandled error event and exits.
            this.logger.error({ reason: error.message }, 'Redis connection error');
        });
        this.client.on('ready', () => {
            this.logger.info({}, 'Redis connection ready');
        });
    }
    /** Establishes Redis connection; maps failures to {@link ServiceUnavailableError}. */
    async connect() {
        try {
            await this.client.connect();
        }
        catch (error) {
            throw new ServiceUnavailableError('Redis is unavailable', {
                reason: toErrorMessage(error),
            });
        }
    }
    /** PING for readiness probes. */
    async healthCheck() {
        await this.run('ping', () => this.client.ping());
    }
    /**
     * Wraps a Redis call with timing, metrics and error normalisation.
     *
     * `operation` must be a constant such as `cache.get`: it becomes a metric
     * label, so an interpolated key would explode cardinality.
     */
    async run(operation, work) {
        const startedAt = performance.now();
        let success = false;
        try {
            const result = await work();
            success = true;
            return result;
        }
        catch (error) {
            throw new ServiceUnavailableError('Redis operation failed', {
                operation,
                reason: toErrorMessage(error),
            });
        }
        finally {
            this.metrics.recordRedisOperation({
                operation,
                durationSeconds: (performance.now() - startedAt) / 1_000,
                success,
            });
        }
    }
    /** QUIT (or disconnect on failure) and mark connection closed. */
    async close() {
        if (this.closed)
            return;
        this.closed = true;
        try {
            // QUIT waits for in-flight commands; disconnect() would drop them.
            await this.client.quit();
        }
        catch {
            this.client.disconnect();
        }
        this.logger.info({}, 'Redis connection closed');
    }
}
