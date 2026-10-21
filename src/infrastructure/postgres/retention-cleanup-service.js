import { AppError, describeErrorForLog, toErrorMessage } from '../../shared/errors/index.js';
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
    /** Wires repositories and retention day/batch settings from app config. */
    constructor(outbox, inbox, idempotency, webhookDeliveries, config, logger, metrics) {
        this.outbox = outbox;
        this.inbox = inbox;
        this.idempotency = idempotency;
        this.webhookDeliveries = webhookDeliveries;
        this.config = config;
        this.logger = logger;
        this.metrics = metrics;
    }
    /** Purges outbox, inbox, idempotency, and webhook delivery rows by retention policy; records metrics. */
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
            failures.push({ resource: 'outbox', reason: retentionFailureSummary(error) });
            recordRetentionCleanupFailure(this.metrics, 'outbox');
            this.logger.error({ resource: 'outbox', err: describeErrorForLog(error) }, 'Outbox retention cleanup failed');
        }
        try {
            stats.inboxDeleted = await this.purgeInbox(computeRetentionCutoff(this.config.inboxDays, now));
        }
        catch (error) {
            failures.push({ resource: 'inbox', reason: retentionFailureSummary(error) });
            recordRetentionCleanupFailure(this.metrics, 'inbox');
            this.logger.error({ resource: 'inbox', err: describeErrorForLog(error) }, 'Inbox retention cleanup failed');
        }
        try {
            stats.idempotencyDeleted = await this.purgeIdempotency(computeRetentionCutoff(this.config.idempotencyDays, now));
        }
        catch (error) {
            failures.push({ resource: 'idempotency', reason: retentionFailureSummary(error) });
            recordRetentionCleanupFailure(this.metrics, 'idempotency');
            this.logger.error({ resource: 'idempotency', err: describeErrorForLog(error) }, 'Idempotency retention cleanup failed');
        }
        try {
            stats.webhookDeliveriesDeleted = await this.purgeWebhookDeliveries(computeRetentionCutoff(this.config.webhookDeliveryDays, now));
        }
        catch (error) {
            failures.push({ resource: 'webhook_deliveries', reason: retentionFailureSummary(error) });
            recordRetentionCleanupFailure(this.metrics, 'webhook_deliveries');
            this.logger.error({ resource: 'webhook_deliveries', err: describeErrorForLog(error) }, 'Webhook delivery retention cleanup failed');
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
    /** Deletes published outbox rows older than `cutoff` in bounded batches. */
    async purgeOutbox(cutoff) {
        return this.purgeInBatches((batchSize) => this.outbox.purgePublishedBefore(cutoff, batchSize));
    }
    /** Deletes processed inbox rows older than `cutoff` in bounded batches. */
    async purgeInbox(cutoff) {
        return this.purgeInBatches((batchSize) => this.inbox.purgeProcessedBefore(cutoff, batchSize));
    }
    /** Deletes expired idempotency records before `cutoff` in bounded batches. */
    async purgeIdempotency(cutoff) {
        return this.purgeInBatches((batchSize) => this.idempotency.purgeExpiredBefore(cutoff, batchSize));
    }
    /** Deletes terminal webhook delivery rows older than `cutoff` in bounded batches. */
    async purgeWebhookDeliveries(cutoff) {
        return this.purgeInBatches((batchSize) => this.webhookDeliveries.purgeTerminalBefore(cutoff, batchSize));
    }
    /** Repeats `purgeBatch` until a batch returns fewer rows than the configured batch size. */
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
/** Human-readable failure message, appending DB operation from safe details when present. */
function retentionFailureSummary(error) {
    const message = toErrorMessage(error);
    if (AppError.isAppError(error) && error.safeDetails?.operation !== undefined) {
        return `${message} (operation=${String(error.safeDetails.operation)})`;
    }
    return message;
}
export class RetentionCleanupError extends Error {
    failures;
    stats;
    /** Aggregates per-resource failures after a partially successful retention run. */
    constructor(failures, stats) {
        super(`Retention cleanup failed for: ${failures.map((failure) => failure.resource).join(', ')}`);
        this.name = 'RetentionCleanupError';
        this.failures = failures;
        this.stats = stats;
    }
}
