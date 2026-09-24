import { randomUUID } from 'node:crypto';
import { toErrorMessage } from '../../../shared/errors/index.js';
import { clampBatchSize } from '../../../shared/pagination/index.js';
import { ChannelStatus } from '../../channels/public/index.js';
import { OfferStatus } from '../../offers/public/index.js';
import { CATALOG_SYNC_RECONCILIATION_CORRELATION_ID } from './catalog-sync-reconciliation.constants.js';
import { planCatalogSyncJobsForReconciliationOffer } from './plan-catalog-sync-reconciliation-jobs.js';
import {
    recordCatalogSyncReconciliationFailure,
    recordCatalogSyncReconciliationOutcome,
} from '../../../shared/metrics/record-catalog-sync-reconciliation.js';

/**
 * Scheduled outbound catalog reconciliation: discovers eligible channel offers and
 * enqueues coalesced jobs on the existing channel-catalog-sync queue.
 */
export class CatalogSyncReconciliationService {
    deps;
    /** @type {{ tenantIds: string[], tenantIndex: number, channelIndex: number, offerCursor: { createdAt: Date, id: string } | null } | null} */
    checkpoint = null;

    /**
     * @param {object} deps
     * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
     * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('../../offers/public/offer-query-service.js').DefaultOfferQueryService} deps.offerQueryService
     * @param {import('./catalog-sync-enqueue-service.js').CatalogSyncEnqueueService} deps.enqueueService
     * @param {import('../../pricing/public/pricing-service.js').DefaultPricingService} [deps.pricingService]
     * @param {{ enabled: boolean, offerBatchSize: number, maxJobsPerTick: number }} deps.config
     * @param {import('../../../shared/logging/logger.port.js').Logger} deps.logger
     * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /** @param {Date} [now] */
    async run(now = new Date()) {
        if (!this.deps.config.enabled) {
            return { outcome: 'disabled' };
        }
        const startedAt = Date.now();
        const offerBatchSize = clampBatchSize(this.deps.config.offerBatchSize);
        const maxJobsPerTick = clampBatchSize(this.deps.config.maxJobsPerTick);
        const sourceEventId = randomUUID();
        const correlationId = CATALOG_SYNC_RECONCILIATION_CORRELATION_ID;
        const stats = {
            offersScanned: 0,
            offersSkipped: 0,
            jobsPlanned: 0,
            channelsVisited: 0,
        };
        this.deps.logger.info({
            offerBatchSize,
            maxJobsPerTick,
            sourceEventId,
        }, 'Catalog sync reconciliation started');
        try {
            if (this.checkpoint === null) {
                const tenants = await this.deps.database.query(`SELECT id FROM tenants ORDER BY id`, [], {
                    operation: 'catalog_sync_reconciliation.list_tenants',
                });
                this.checkpoint = {
                    tenantIds: tenants.rows.map((row) => String(row['id'])),
                    tenantIndex: 0,
                    channelIndex: 0,
                    offerCursor: null,
                };
            }
            const checkpoint = this.checkpoint;
            let limitsReached = false;
            while (!limitsReached && checkpoint.tenantIndex < checkpoint.tenantIds.length) {
                const tenantId = checkpoint.tenantIds[checkpoint.tenantIndex];
                await this.deps.database.execute(async () => {
                    const channels = await this.deps.channelQueryService.listChannels(tenantId, {
                        status: ChannelStatus.ACTIVE,
                    });
                    while (!limitsReached && checkpoint.channelIndex < channels.length) {
                        const channel = channels[checkpoint.channelIndex];
                        if (checkpoint.offerCursor === null) {
                            stats.channelsVisited += 1;
                        }
                        const offerLimit = offerBatchSize - stats.offersScanned;
                        if (offerLimit <= 0 || stats.jobsPlanned >= maxJobsPerTick) {
                            limitsReached = true;
                            break;
                        }
                        const page = await this.deps.offerQueryService.listOffersPage(
                            tenantId,
                            {
                                channelId: channel.id,
                                status: OfferStatus.ACTIVE,
                            },
                            offerLimit,
                            checkpoint.offerCursor,
                        );
                        /** @type {{ createdAt: Date, id: string } | null} */
                        let lastProcessedCursor = checkpoint.offerCursor;
                        for (const offer of page.items) {
                            if (stats.offersScanned >= offerBatchSize || stats.jobsPlanned >= maxJobsPerTick) {
                                limitsReached = true;
                                break;
                            }
                            stats.offersScanned += 1;
                            const plan = await planCatalogSyncJobsForReconciliationOffer(
                                offer,
                                channel,
                                sourceEventId,
                                correlationId,
                                this.deps.pricingService,
                            );
                            if (plan.skippedOffer) {
                                stats.offersSkipped += 1;
                                lastProcessedCursor = { createdAt: offer.createdAt, id: offer.id };
                                continue;
                            }
                            const remainingJobs = maxJobsPerTick - stats.jobsPlanned;
                            const jobsToEnqueue = plan.jobs.slice(0, remainingJobs);
                            if (jobsToEnqueue.length === 0) {
                                limitsReached = true;
                                break;
                            }
                            const { enqueued } = await this.deps.enqueueService.enqueuePlannedJobs(jobsToEnqueue);
                            stats.jobsPlanned += enqueued;
                            lastProcessedCursor = { createdAt: offer.createdAt, id: offer.id };
                            if (enqueued < plan.jobs.length) {
                                limitsReached = true;
                                break;
                            }
                        }
                        if (limitsReached) {
                            checkpoint.offerCursor = lastProcessedCursor;
                            return;
                        }
                        if (page.nextCursor !== null && !limitsReached) {
                            checkpoint.offerCursor = page.nextCursor;
                            continue;
                        }
                        checkpoint.offerCursor = null;
                        checkpoint.channelIndex += 1;
                    }
                    if (checkpoint.channelIndex >= channels.length) {
                        checkpoint.channelIndex = 0;
                        checkpoint.tenantIndex += 1;
                    }
                }, { tenantId });
            }
            if (checkpoint.tenantIndex >= checkpoint.tenantIds.length) {
                this.checkpoint = null;
            }
            const durationSeconds = (Date.now() - startedAt) / 1_000;
            recordCatalogSyncReconciliationOutcome(this.deps.metrics, stats, durationSeconds);
            this.deps.logger.info({ ...stats, durationSeconds, at: now.toISOString() }, 'Catalog sync reconciliation completed');
            return { outcome: 'success', ...stats };
        }
        catch (error) {
            recordCatalogSyncReconciliationFailure(this.deps.metrics);
            this.deps.logger.error({ reason: toErrorMessage(error) }, 'Catalog sync reconciliation failed');
            throw error;
        }
    }

    /** Resets scan checkpoint (tests). */
    resetCheckpoint() {
        this.checkpoint = null;
    }
}
