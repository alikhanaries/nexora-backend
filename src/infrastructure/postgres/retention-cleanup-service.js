import { toErrorMessage } from '../../shared/errors/index.js';
import { recordRetentionCleanupFailure, recordRetentionCleanupOutcome, } from '../../shared/metrics/record-retention-cleanup.js';
const MS_PER_DAY = 86_400_000;
/**
 * Computes a UTC cutoff timestamp for retention sweeps.
 *
 * Records with a relevant timestamp strictly before this value are eligible.
 */
export function computeRetentionCutoff(retentionDays, now = new Date()) {
    return new Date(now.getTime() - retentionDays * MS_PER_DAY);
}
/**
 * Bounded retention sweeps for published outbox rows, processed inbox rows,
 * and expired idempotency records.
 */
export class RetentionCleanupService {
    outbox;
    inbox;
    idempotency;
    webhookDeliveries;
    config;
    logger;
    metrics;
    constructor(outbox, inbox, idempotency, webhookDeliveries, config, logger, metrics) {
        this.outbox = outbox;
        this.inbox = inbox;
        this.idempotency = idempotency;
        this.webhookDeliveries = webhookDeliveries;
        this.config = config;
        this.logger = logger;
        this.metrics = metrics;
    }
    async run(now = new Date()) {
        const startedAt = Date.now();
        const stats = {
            outboxDeleted: 0,
            inboxDeleted: 0,
            idempotencyDeleted: 0,
            webhookDeliveriesDeleted: 0,
        };
        const failures = [];
        this.logger.info({
            outboxRetentionDays: this.config.outboxDays,
            inboxRetentionDays: this.config.inboxDays,
            idempotencyRetentionDays: this.config.idempotencyDays,
            webhookDeliveryRetentionDays: this.config.webhookDeliveryDays,
            batchSize: this.config.batchSize,
        }, 'Retention cleanup started');
        try {
            stats.outboxDeleted = await this.purgeOutbox(computeRetentionCutoff(this.config.outboxDays, now));
        }
        catch (error) {
            failures.push({ resource: 'outbox', reason: toErrorMessage(error) });
            recordRetentionCleanupFailure(this.metrics, 'outbox');
            this.logger.error({ resource: 'outbox', reason: toErrorMessage(error) }, 'Outbox retention cleanup failed');
        }
        try {
            stats.inboxDeleted = await this.purgeInbox(computeRetentionCutoff(this.config.inboxDays, now));
        }
        catch (error) {
            failures.push({ resource: 'inbox', reason: toErrorMessage(error) });
            recordRetentionCleanupFailure(this.metrics, 'inbox');
            this.logger.error({ resource: 'inbox', reason: toErrorMessage(error) }, 'Inbox retention cleanup failed');
        }
        try {
            stats.idempotencyDeleted = await this.purgeIdempotency(computeRetentionCutoff(this.config.idempotencyDays, now));
        }
        catch (error) {
            failures.push({ resource: 'idempotency', reason: toErrorMessage(error) });
            recordRetentionCleanupFailure(this.metrics, 'idempotency');
            this.logger.error({ resource: 'idempotency', reason: toErrorMessage(error) }, 'Idempotency retention cleanup failed');
        }
        try {
            stats.webhookDeliveriesDeleted = await this.purgeWebhookDeliveries(computeRetentionCutoff(this.config.webhookDeliveryDays, now));
        }
        catch (error) {
            failures.push({ resource: 'webhook_deliveries', reason: toErrorMessage(error) });
            recordRetentionCleanupFailure(this.metrics, 'webhook_deliveries');
            this.logger.error({ resource: 'webhook_deliveries', reason: toErrorMessage(error) }, 'Webhook delivery retention cleanup failed');
        }
        const durationSeconds = (Date.now() - startedAt) / 1_000;
        if (failures.length === 0) {
            recordRetentionCleanupOutcome(this.metrics, stats, durationSeconds);
            this.logger.info({
                outboxDeleted: stats.outboxDeleted,
                inboxDeleted: stats.inboxDeleted,
                idempotencyDeleted: stats.idempotencyDeleted,
                webhookDeliveriesDeleted: stats.webhookDeliveriesDeleted,
                durationSeconds,
            }, 'Retention cleanup completed');
            return stats;
        }
        recordRetentionCleanupFailure(this.metrics, 'run');
        this.logger.error({
            outboxDeleted: stats.outboxDeleted,
            inboxDeleted: stats.inboxDeleted,
            idempotencyDeleted: stats.idempotencyDeleted,
            webhookDeliveriesDeleted: stats.webhookDeliveriesDeleted,
            durationSeconds,
            failures,
        }, 'Retention cleanup finished with failures');
        throw new RetentionCleanupError(failures, stats);
    }
    async purgeOutbox(cutoff) {
        return this.purgeInBatches((batchSize) => this.outbox.purgePublishedBefore(cutoff, batchSize));
    }
    async purgeInbox(cutoff) {
        return this.purgeInBatches((batchSize) => this.inbox.purgeProcessedBefore(cutoff, batchSize));
    }
    async purgeIdempotency(cutoff) {
        return this.purgeInBatches((batchSize) => this.idempotency.purgeExpiredBefore(cutoff, batchSize));
    }
    async purgeWebhookDeliveries(cutoff) {
        return this.purgeInBatches((batchSize) => this.webhookDeliveries.purgeTerminalBefore(cutoff, batchSize));
    }
    async purgeInBatches(purgeBatch) {
        let total = 0;
        let deleted;
        do {
            deleted = await purgeBatch(this.config.batchSize);
            total += deleted;
        } while (deleted === this.config.batchSize);
        return total;
    }
}
export class RetentionCleanupError extends Error {
    failures;
    stats;
    constructor(failures, stats) {
        super(`Retention cleanup failed for: ${failures.map((failure) => failure.resource).join(', ')}`);
        this.name = 'RetentionCleanupError';
        this.failures = failures;
        this.stats = stats;
    }
}
