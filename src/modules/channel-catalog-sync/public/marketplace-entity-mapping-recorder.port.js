/**
 * Optional mapping hints returned by adapters after a successful sync.
 *
 * @typedef {object} MarketplaceCatalogSyncMappingHint
 * @property {'product'|'offer'|'stock_location'} nexoraEntityType
 * @property {string} nexoraEntityId
 * @property {string} externalEntityType
 * @property {string} externalEntityId
 */

/**
 * @typedef {MarketplaceCatalogSyncMappingHint[]|void} MarketplaceCatalogSyncResult
 */

/**
 * @typedef {object} MarketplaceEntityMappingRecorder
 * @property {(input: {
 *   tenantId: string,
 *   channelId: string,
 *   marketplaceKey: string,
 *   mappings: MarketplaceCatalogSyncMappingHint[],
 *   tx: object,
 * }) => Promise<void>} recordMappings
 */
