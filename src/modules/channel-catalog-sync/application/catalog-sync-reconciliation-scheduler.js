import { toErrorMessage } from '../../../shared/errors/index.js';

/**
 * Interval-driven catalog sync reconciliation.
 *
 * Uses the same polling + Redis lock model as {@link RetentionCleanupScheduler}.
 */
export class CatalogSyncReconciliationScheduler {
    service;
    lock;
    config;
    logger;
    lockTtlSeconds;
    timer;
    running = false;
    stopped = false;

    /**
     * @param {import('./catalog-sync-reconciliation-service.js').CatalogSyncReconciliationService} service
     * @param {import('../../../infrastructure/redis/redis-distributed-lock.js').RedisDistributedLock} lock
     * @param {{ enabled: boolean, intervalMs: number }} config
     * @param {import('../../../shared/logging/logger.port.js').Logger} logger
     * @param {number} lockTtlSeconds
     */
    constructor(service, lock, config, logger, lockTtlSeconds) {
        this.service = service;
        this.lock = lock;
        this.config = config;
        this.logger = logger;
        this.lockTtlSeconds = lockTtlSeconds;
    }

    start() {
        if (!this.config.enabled || this.timer !== undefined) {
            return;
        }
        this.timer = setInterval(() => {
            void this.tick();
        }, this.config.intervalMs);
        void this.tick();
        this.logger.info({ intervalMs: this.config.intervalMs }, 'Catalog sync reconciliation scheduler started');
    }

    async stop() {
        this.stopped = true;
        if (this.timer !== undefined) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        while (this.running) {
            await sleep(50);
        }
        this.logger.info({}, 'Catalog sync reconciliation scheduler stopped');
    }

    /** One reconciliation cycle; exposed for tests. */
    async tick() {
        if (!this.config.enabled || this.stopped || this.running) {
            return undefined;
        }
        this.running = true;
        try {
            const result = await this.lock.withLock('catalog-sync-reconciliation', this.lockTtlSeconds, async () => this.service.run());
            if (result === undefined) {
                this.logger.debug({}, 'Catalog sync reconciliation skipped; lock held by another instance');
            }
            return result;
        }
        catch (error) {
            this.logger.error({ reason: toErrorMessage(error) }, 'Catalog sync reconciliation tick failed');
            throw error;
        }
        finally {
            this.running = false;
        }
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
