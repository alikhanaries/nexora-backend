import { describeErrorForLog, toErrorMessage } from '../../shared/errors/index.js';
import { RetentionCleanupError } from './retention-cleanup-service.js';
/**
 * Interval-driven retention sweeper.
 *
 * Uses the same polling model as {@link OutboxPublisher} and coordinates
 * overlapping worker replicas with a Redis distributed lock.
 */
export class RetentionCleanupScheduler {
    service;
    lock;
    config;
    logger;
    lockTtlSeconds;
    timer;
    running = false;
    stopped = false;
    /** @param {import('./retention-cleanup-service.js').RetentionCleanupService} service @param {import('../redis/redis-distributed-lock.js').RedisDistributedLock} lock */
    constructor(service, lock, config, logger, lockTtlSeconds) {
        this.service = service;
        this.lock = lock;
        this.config = config;
        this.logger = logger;
        this.lockTtlSeconds = lockTtlSeconds;
    }
    /** Starts interval ticks and runs cleanup immediately. */
    start() {
        if (this.timer !== undefined)
            return;
        this.timer = setInterval(() => {
            void this.runScheduledTick();
        }, this.config.intervalMs);
        void this.runScheduledTick();
        this.logger.info({ intervalMs: this.config.intervalMs }, 'Retention cleanup scheduler started');
    }
    /** Stops scheduling and waits for an in-flight tick. */
    async stop() {
        this.stopped = true;
        if (this.timer !== undefined) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        while (this.running) {
            await sleep(50);
        }
        this.logger.info({}, 'Retention cleanup scheduler stopped');
    }
    /** One cleanup cycle; exposed for tests. */
    async tick() {
        if (this.stopped || this.running)
            return undefined;
        this.running = true;
        try {
            const result = await this.lock.withLock('retention-cleanup', this.lockTtlSeconds, async () => this.service.run());
            if (result === undefined) {
                this.logger.debug({}, 'Retention cleanup skipped; lock held by another instance');
            }
            return result;
        }
        catch (error) {
            this.logTickFailure(error);
            return undefined;
        }
        finally {
            this.running = false;
        }
    }
    /** Interval driver: never rejects; failures are logged for observability. */
    async runScheduledTick() {
        try {
            await this.tick();
        }
        catch (error) {
            this.logTickFailure(error);
        }
    }
    /** Structured error log for tick failures, including partial retention stats when available. */
    logTickFailure(error) {
        const payload = {
            reason: toErrorMessage(error),
            err: describeErrorForLog(error),
        };
        if (error instanceof RetentionCleanupError) {
            payload.failures = error.failures;
            payload.stats = error.stats;
        }
        this.logger.error(payload, 'Retention cleanup tick failed');
    }
}
/** Promise delay while waiting for an active tick during shutdown. */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
