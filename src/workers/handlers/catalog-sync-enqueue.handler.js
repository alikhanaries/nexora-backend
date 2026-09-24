/**
 * Fans out catalog-related integration events into channel-catalog-sync jobs.
 */
export class CatalogSyncEnqueueHandler {
    channelCatalogSyncService;
    consumerName = 'channel-catalog-sync.enqueue';

    /**
     * @param {import('../../modules/channel-catalog-sync/application/channel-catalog-sync-service.js').ChannelCatalogSyncService} channelCatalogSyncService
     */
    constructor(channelCatalogSyncService) {
        this.channelCatalogSyncService = channelCatalogSyncService;
    }

    /**
     * @param {import('../../shared/events/integration-event.js').IntegrationEvent} event
     */
    async handle(event) {
        await this.channelCatalogSyncService.enqueueFromIntegrationEvent(event);
    }
}
