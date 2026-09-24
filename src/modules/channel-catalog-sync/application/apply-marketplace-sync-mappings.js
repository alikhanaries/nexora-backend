/**
 * @param {import('../public/marketplace-entity-mapping-recorder.port.js').MarketplaceEntityMappingRecorder | undefined} recorder
 * @param {import('../public/marketplace-entity-mapping-recorder.port.js').MarketplaceCatalogSyncResult} result
 * @param {object} context
 * @param {string} context.tenantId
 * @param {string} context.channelId
 * @param {string} context.marketplaceKey
 * @param {object} context.tx
 */
export async function applyMarketplaceSyncMappings(recorder, result, context) {
    if (recorder === undefined || result === undefined || result.length === 0) {
        return;
    }
    await recorder.recordMappings({
        tenantId: context.tenantId,
        channelId: context.channelId,
        marketplaceKey: context.marketplaceKey,
        mappings: result,
        tx: context.tx,
    });
}
