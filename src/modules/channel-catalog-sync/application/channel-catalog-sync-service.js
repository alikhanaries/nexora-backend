/**
 * Public application contract for channel catalog synchronization (Phase 16 foundation).
 */
export class ChannelCatalogSyncService {
    enqueueService;
    executeJob;

    /**
     * @param {object} deps
     * @param {import('./catalog-sync-enqueue-service.js').CatalogSyncEnqueueService} deps.enqueueService
     * @param {import('./execute-catalog-sync-job.js').ExecuteCatalogSyncJob} deps.executeJob
     */
    constructor(deps) {
        this.enqueueService = deps.enqueueService;
        this.executeJob = deps.executeJob;
    }

    /**
     * @param {import('../../../shared/events/integration-event.js').IntegrationEvent} event
     */
    async enqueueFromIntegrationEvent(event) {
        return this.enqueueService.enqueueFromIntegrationEvent(event);
    }

    /**
     * @param {unknown} jobPayload
     */
    async processSyncJob(jobPayload) {
        return this.executeJob.execute(jobPayload);
    }
}
