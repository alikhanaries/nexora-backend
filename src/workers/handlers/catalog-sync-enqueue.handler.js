import { WASL_NAMING } from '../../shared/config/wasl-naming.config.js';

/**
 * Fans out catalog-related integration events into integration catalog sync jobs.
 */
export class CatalogSyncEnqueueHandler {
    channelCatalogSyncService;
    consumerName = WASL_NAMING.infrastructure.queue.inboxConsumers.catalogSyncEnqueue;

    /**
     * @param {import('../modules/integration-catalog-sync/services/integration-catalog-sync-service.js').IntegrationCatalogSyncService} channelCatalogSyncService
     */
    constructor(channelCatalogSyncService) {
        this.channelCatalogSyncService = channelCatalogSyncService;
    }

    /**
     * @param {import('../shared/events/integration-event.js').IntegrationEvent} event
     */
    async handle(event) {
        await this.channelCatalogSyncService.enqueueFromIntegrationEvent(event);
    }
}
