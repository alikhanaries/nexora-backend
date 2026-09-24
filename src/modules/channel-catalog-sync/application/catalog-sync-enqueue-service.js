import { JobName, QueueName } from '../../../infrastructure/queue/queue-names.js';
import { buildCatalogSyncJobId } from './build-catalog-sync-job-id.js';
import { planCatalogSyncJobsFromEvent } from './plan-catalog-sync-jobs.js';

export class CatalogSyncEnqueueService {
    deps;

    /**
     * @param {object} deps
     * @param {import('../../../shared/queue/job-queue.port.js').JobQueue} deps.queue
     * @param {import('../../offers/public/offer-query-service.js').DefaultOfferQueryService} deps.offerQueryService
     * @param {import('../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {import('../../../shared/events/integration-event.js').IntegrationEvent} event
     */
    async enqueueFromIntegrationEvent(event) {
        const planned = await planCatalogSyncJobsFromEvent(event, {
            offerQueryService: this.deps.offerQueryService,
            channelQueryService: this.deps.channelQueryService,
        });
        for (const job of planned) {
            const jobId = buildCatalogSyncJobId({
                tenantId: job.tenantId,
                channelId: job.channelId,
                target: job.target,
                entityId: job.entityId,
                ...(job.stockLocationId === undefined ? {} : { stockLocationId: job.stockLocationId }),
            });
            await this.deps.queue.enqueue(
                QueueName.CHANNEL_CATALOG_SYNC,
                JobName.RUN_CATALOG_SYNC,
                {
                    tenantId: job.tenantId,
                    channelId: job.channelId,
                    target: job.target,
                    entityId: job.entityId,
                    operation: job.operation,
                    sourceEventId: job.sourceEventId,
                    correlationId: job.correlationId,
                    ...(job.stockLocationId === undefined ? {} : { stockLocationId: job.stockLocationId }),
                },
                { jobId },
            );
            this.deps.metrics?.recordQueueJobEnqueued(QueueName.CHANNEL_CATALOG_SYNC, JobName.RUN_CATALOG_SYNC);
        }
        return { enqueued: planned.length };
    }
}
