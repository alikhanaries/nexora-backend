export class DefaultMarketplaceEntityMappingRecorder {
    deps;

    /**
     * @param {object} deps
     * @param {import('./marketplace-entity-mapping-service.js').MarketplaceEntityMappingService} deps.mappingService
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {import('../../channel-catalog-sync/public/marketplace-entity-mapping-recorder.port.js').MarketplaceCatalogSyncMappingHint[]} input.mappings
     */
    async recordMappings(input) {
        if (input.mappings.length === 0) {
            return;
        }
        for (const hint of input.mappings) {
            await this.deps.mappingService.upsertMapping({
                tenantId: input.tenantId,
                channelId: input.channelId,
                marketplaceKey: input.marketplaceKey,
                nexoraEntityType: hint.nexoraEntityType,
                nexoraEntityId: hint.nexoraEntityId,
                externalEntityType: hint.externalEntityType,
                externalEntityId: hint.externalEntityId,
                tx: input.tx,
            });
        }
    }
}
